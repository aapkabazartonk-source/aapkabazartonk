import { Types } from "mongoose";
import { postAccountTransaction } from "@/lib/account-ledger";
import { AccountsError } from "@/lib/accounts-error";
import {
  type SalaryPaymentMethod,
  type SalaryRecordStatus,
} from "@/lib/constants";
import { nextDailySequence } from "@/lib/document-numbers";
import { withMongoTransaction, type StockScope } from "@/lib/inventory-stock";
import { roundMoney } from "@/lib/money";
import { FinancialAccount } from "@/models/FinancialAccount";
import { SalaryPayment } from "@/models/SalaryPayment";
import { SalaryRecord } from "@/models/SalaryRecord";
import { Staff } from "@/models/Staff";
import { StaffAdvance } from "@/models/StaffAdvance";

function statusOf(netPayable: number, amountPaid: number): SalaryRecordStatus {
  if (amountPaid <= 0) return "UNPAID";
  if (amountPaid + 0.001 >= netPayable) return "PAID";
  return "PARTIAL";
}

export async function createStaff(params: {
  scope: StockScope;
  data: {
    name: string;
    phone?: string;
    designation?: string;
    joiningDate: string | Date;
    monthlySalary: number;
    paymentPreference?: SalaryPaymentMethod;
    notes?: string;
  };
}) {
  const staff = await Staff.create({
    businessId: params.scope.businessId,
    storeId: params.scope.storeId,
    name: params.data.name.trim(),
    phone: (params.data.phone ?? "").trim(),
    designation: (params.data.designation ?? "").trim(),
    joiningDate: new Date(params.data.joiningDate),
    monthlySalary: roundMoney(params.data.monthlySalary),
    paymentPreference: params.data.paymentPreference ?? "CASH",
    isActive: true,
    notes: (params.data.notes ?? "").trim(),
  });
  await StaffAdvance.create({
    businessId: params.scope.businessId,
    storeId: params.scope.storeId,
    staffId: staff._id,
    balance: 0,
  });
  return staff;
}

export async function updateStaff(params: {
  scope: StockScope;
  staffId: string;
  data: Partial<{
    name: string;
    phone: string;
    designation: string;
    joiningDate: string | Date;
    monthlySalary: number;
    paymentPreference: SalaryPaymentMethod;
    isActive: boolean;
    notes: string;
  }>;
}) {
  const staff = await Staff.findOne({
    _id: params.staffId,
    businessId: params.scope.businessId,
  });
  if (!staff) throw new AccountsError("Staff member not found.", 404);
  if (params.data.name !== undefined) staff.name = params.data.name.trim();
  if (params.data.phone !== undefined) staff.phone = params.data.phone.trim();
  if (params.data.designation !== undefined) {
    staff.designation = params.data.designation.trim();
  }
  if (params.data.joiningDate !== undefined) {
    staff.joiningDate = new Date(params.data.joiningDate);
  }
  if (params.data.monthlySalary !== undefined) {
    staff.monthlySalary = roundMoney(params.data.monthlySalary);
  }
  if (params.data.paymentPreference !== undefined) {
    staff.paymentPreference = params.data.paymentPreference;
  }
  if (params.data.isActive !== undefined) staff.isActive = params.data.isActive;
  if (params.data.notes !== undefined) staff.notes = params.data.notes.trim();
  await staff.save();
  return staff;
}

export async function createSalaryRecord(params: {
  scope: StockScope;
  data: {
    staffId: string;
    period: string;
    bonus?: number;
    deductions?: number;
    notes?: string;
  };
}) {
  if (!/^\d{4}-\d{2}$/.test(params.data.period)) {
    throw new AccountsError("Salary period must be YYYY-MM.");
  }

  const staff = await Staff.findOne({
    _id: params.data.staffId,
    businessId: params.scope.businessId,
  });
  if (!staff) throw new AccountsError("Staff member not found.", 404);

  const existing = await SalaryRecord.findOne({
    businessId: params.scope.businessId,
    staffId: staff._id,
    period: params.data.period,
  });
  if (existing) {
    throw new AccountsError(
      "A salary record already exists for this staff member and period.",
      409,
      "DUPLICATE_SALARY_PERIOD",
    );
  }

  return withMongoTransaction(async (session) => {
    const advance = await StaffAdvance.findOne({
      businessId: params.scope.businessId,
      staffId: staff._id,
    }).session(session);

    const bonus = roundMoney(params.data.bonus ?? 0);
    const deductions = roundMoney(params.data.deductions ?? 0);
    const baseSalary = roundMoney(staff.monthlySalary);
    const beforeAdvance = roundMoney(Math.max(0, baseSalary + bonus - deductions));
    const advanceAvailable = roundMoney(advance?.balance ?? 0);
    const advanceAdjusted = roundMoney(Math.min(advanceAvailable, beforeAdvance));
    const netPayable = roundMoney(beforeAdvance - advanceAdjusted);

    if (advance && advanceAdjusted > 0) {
      advance.balance = roundMoney(advance.balance - advanceAdjusted);
      await advance.save({ session });
    }

    const [record] = await SalaryRecord.create(
      [
        {
          businessId: params.scope.businessId,
          storeId: params.scope.storeId,
          staffId: staff._id,
          staffName: staff.name,
          period: params.data.period,
          baseSalary,
          bonus,
          deductions,
          advanceAdjusted,
          netPayable,
          amountPaid: 0,
          balanceDue: netPayable,
          status: statusOf(netPayable, 0),
          expenseRecognized: true,
          notes: (params.data.notes ?? "").trim(),
          createdBy: params.scope.performedBy ?? null,
        },
      ],
      { session },
    );

    return record;
  });
}

export async function paySalary(params: {
  scope: StockScope;
  data: {
    staffId: string;
    salaryRecordId?: string | null;
    paymentKind: "REGULAR" | "ADVANCE" | "BONUS";
    amount: number;
    paymentMethod: SalaryPaymentMethod;
    accountId: string;
    paymentDate?: string | Date;
    notes?: string;
    idempotencyKey: string;
  };
}) {
  const amount = roundMoney(params.data.amount);
  if (amount <= 0) throw new AccountsError("Payment amount must be greater than 0.");

  return withMongoTransaction(async (session) => {
    const existing = await SalaryPayment.findOne({
      businessId: params.scope.businessId,
      idempotencyKey: params.data.idempotencyKey,
    }).session(session);
    if (existing) return existing;

    const staff = await Staff.findOne({
      _id: params.data.staffId,
      businessId: params.scope.businessId,
    }).session(session);
    if (!staff) throw new AccountsError("Staff member not found.", 404);

    const account = await FinancialAccount.findOne({
      _id: params.data.accountId,
      businessId: params.scope.businessId,
      isActive: true,
    }).session(session);
    if (!account) throw new AccountsError("Account not found.", 404);

    let salaryRecord: InstanceType<typeof SalaryRecord> | null = null;
    if (params.data.paymentKind === "REGULAR") {
      if (!params.data.salaryRecordId) {
        throw new AccountsError("Select a salary period for regular payment.");
      }
      salaryRecord = await SalaryRecord.findOne({
        _id: params.data.salaryRecordId,
        businessId: params.scope.businessId,
        staffId: staff._id,
      }).session(session);
      if (!salaryRecord) throw new AccountsError("Salary record not found.", 404);
      if (salaryRecord.balanceDue + 0.001 < amount) {
        throw new AccountsError("Payment exceeds outstanding salary.");
      }
    }

    const paymentNumber = await nextDailySequence(
      (prefix) =>
        SalaryPayment.countDocuments({
          businessId: params.scope.businessId,
          paymentNumber: { $regex: `^${prefix}` },
        }).session(session),
      "SALPAY",
    );

    const [payment] = await SalaryPayment.create(
      [
        {
          businessId: params.scope.businessId,
          storeId: params.scope.storeId,
          staffId: staff._id,
          salaryRecordId: salaryRecord?._id ?? null,
          paymentNumber,
          paymentKind: params.data.paymentKind,
          amount,
          paymentMethod: params.data.paymentMethod,
          accountId: account._id,
          paymentDate: params.data.paymentDate
            ? new Date(params.data.paymentDate)
            : new Date(),
          notes: (params.data.notes ?? "").trim(),
          idempotencyKey: params.data.idempotencyKey,
          createdBy: params.scope.performedBy ?? null,
        },
      ],
      { session },
    );

    await postAccountTransaction({
      scope: params.scope,
      session,
      input: {
        accountId: account._id,
        entryType: "SALARY_PAYMENT",
        entryDate: payment.paymentDate,
        description: `Salary ${params.data.paymentKind.toLowerCase()} — ${staff.name}`,
        credit: amount,
        referenceType: "SALARY_PAYMENT",
        referenceId: payment._id,
        referenceNumber: payment.paymentNumber,
        idempotencyKey: `salary-pay:${payment._id}`,
      },
    });

    if (salaryRecord) {
      salaryRecord.amountPaid = roundMoney(salaryRecord.amountPaid + amount);
      salaryRecord.balanceDue = roundMoney(
        salaryRecord.netPayable - salaryRecord.amountPaid,
      );
      salaryRecord.status = statusOf(
        salaryRecord.netPayable,
        salaryRecord.amountPaid,
      );
      await salaryRecord.save({ session });
    }

    if (params.data.paymentKind === "ADVANCE") {
      const advance =
        (await StaffAdvance.findOne({
          businessId: params.scope.businessId,
          staffId: staff._id,
        }).session(session)) ||
        (
          await StaffAdvance.create(
            [
              {
                businessId: params.scope.businessId,
                storeId: params.scope.storeId,
                staffId: staff._id,
                balance: 0,
              },
            ],
            { session },
          )
        )[0];
      advance.balance = roundMoney(advance.balance + amount);
      await advance.save({ session });
    }

    return payment;
  });
}

function periodKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

/** Inclusive YYYY-MM keys covered by [from, to). */
export function salaryPeriodsInRange(from: Date, to: Date) {
  const periods: string[] = [];
  const cursor = new Date(from.getTime());
  // Walk month-by-month in IST calendar space.
  let guard = 0;
  while (guard < 240) {
    const key = periodKey(cursor);
    const endKey = periodKey(new Date(to.getTime() - 1));
    if (key > endKey) break;
    periods.push(key);
    const [year, month] = key.split("-").map(Number);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cursor.setTime(
      new Date(
        `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`,
      ).getTime(),
    );
    if (key === endKey) break;
    guard += 1;
  }
  return periods;
}

export async function sumRecognizedSalaryExpense(params: {
  businessId: Types.ObjectId;
  from: Date;
  to: Date;
}) {
  const periods = salaryPeriodsInRange(params.from, params.to);
  if (periods.length === 0) return 0;

  // Recognize salary once per salary period (YYYY-MM). Advance cash is not
  // re-expensed here — only base + bonus − deductions for the period.
  const rows = await SalaryRecord.aggregate<{ total: number }>([
    {
      $match: {
        businessId: params.businessId,
        expenseRecognized: true,
        period: { $in: periods },
      },
    },
    {
      $group: {
        _id: null,
        total: {
          $sum: {
            $add: ["$baseSalary", "$bonus", { $multiply: ["$deductions", -1] }],
          },
        },
      },
    },
  ]);
  return roundMoney(Math.max(0, rows[0]?.total ?? 0));
}

export async function staffSalaryStats(businessId: Types.ObjectId, period: string) {
  const [activeStaff, records] = await Promise.all([
    Staff.find({ businessId, isActive: true }).lean(),
    SalaryRecord.find({ businessId, period }).lean(),
  ]);

  const commitment = roundMoney(
    activeStaff.reduce((sum, row) => sum + row.monthlySalary, 0),
  );
  const paid = roundMoney(
    records.reduce((sum, row) => sum + row.amountPaid, 0),
  );
  const pending = roundMoney(
    records.reduce((sum, row) => sum + row.balanceDue, 0),
  );

  return {
    activeStaff: activeStaff.length,
    monthlyCommitment: commitment,
    salaryPaidThisPeriod: paid,
    salaryPendingThisPeriod: pending,
  };
}
