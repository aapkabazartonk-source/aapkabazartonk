import { Types } from "mongoose";
import { postAccountTransaction } from "@/lib/account-ledger";
import { AccountsError } from "@/lib/accounts-error";
import {
  DEFAULT_EXPENSE_CATEGORY_NAMES,
  type ExpensePaymentMethod,
  type ExpensePaymentStatus,
} from "@/lib/constants";
import { nextDailySequence } from "@/lib/document-numbers";
import {
  duplicateKeyPattern,
  withMongoTransaction,
  type StockScope,
} from "@/lib/inventory-stock";
import { roundMoney } from "@/lib/money";
import { Expense } from "@/models/Expense";
import { ExpenseCategory } from "@/models/ExpenseCategory";
import { ExpensePayment } from "@/models/ExpensePayment";
import { FinancialAccount } from "@/models/FinancialAccount";

function paymentStatusOf(amount: number, amountPaid: number): ExpensePaymentStatus {
  const paid = roundMoney(amountPaid);
  const total = roundMoney(amount);
  if (paid <= 0) return "PENDING";
  if (paid + 0.001 >= total) return "PAID";
  return "PARTIAL";
}

export async function ensureDefaultExpenseCategories(businessId: Types.ObjectId) {
  for (const name of DEFAULT_EXPENSE_CATEGORY_NAMES) {
    const normalizedName = name.trim().toLowerCase();
    const exists = await ExpenseCategory.findOne({
      businessId,
      normalizedName,
    }).select("_id");
    if (exists) continue;
    try {
      await ExpenseCategory.create({
        businessId,
        name,
        normalizedName,
        isSystem: true,
        isActive: true,
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        continue;
      }
      throw error;
    }
  }
}

export async function listExpenseCategories(businessId: Types.ObjectId) {
  await ensureDefaultExpenseCategories(businessId);
  const rows = await ExpenseCategory.find({ businessId })
    .sort({ isActive: -1, name: 1 })
    .lean();
  return rows.map((row) => ({
    ...row,
    _id: String(row._id),
    businessId: String(row.businessId),
  }));
}

export async function createExpenseCategory(params: {
  businessId: Types.ObjectId;
  name: string;
}) {
  const name = params.name.trim();
  if (!name) throw new AccountsError("Category name is required.");
  try {
    const created = await ExpenseCategory.create({
      businessId: params.businessId,
      name,
      normalizedName: name.toLowerCase(),
      isSystem: false,
      isActive: true,
    });
    return created;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new AccountsError("This expense category already exists.", 409);
    }
    throw error;
  }
}

export async function updateExpenseCategory(params: {
  businessId: Types.ObjectId;
  categoryId: string;
  name?: string;
  isActive?: boolean;
}) {
  const category = await ExpenseCategory.findOne({
    _id: params.categoryId,
    businessId: params.businessId,
  });
  if (!category) throw new AccountsError("Category not found.", 404);

  if (params.name !== undefined) {
    const name = params.name.trim();
    if (!name) throw new AccountsError("Category name is required.");
    category.name = name;
    category.normalizedName = name.toLowerCase();
  }
  if (params.isActive !== undefined) category.isActive = params.isActive;
  try {
    await category.save();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new AccountsError("This expense category already exists.", 409);
    }
    throw error;
  }
  return category;
}

async function nextExpenseNumber(businessId: Types.ObjectId) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await nextDailySequence(
        (prefix) =>
          Expense.countDocuments({
            businessId,
            expenseNumber: { $regex: `^${prefix}` },
          }),
        "EXP",
      );
    } catch (error) {
      const pattern = duplicateKeyPattern(error);
      if (pattern && "expenseNumber" in pattern && attempt < 4) continue;
      throw error;
    }
  }
  throw new AccountsError("Could not allocate expense number.", 500);
}

export async function createExpense(params: {
  scope: StockScope;
  data: {
    title: string;
    categoryId: string;
    amount: number;
    expenseDate: string | Date;
    paymentDate?: string | Date | null;
    paymentMethod?: ExpensePaymentMethod | null;
    accountId?: string | null;
    notes?: string;
    attachmentUrl?: string;
    paymentStatus?: ExpensePaymentStatus;
    payNowAmount?: number;
    idempotencyKey?: string;
  };
}) {
  const amount = roundMoney(params.data.amount);
  if (amount <= 0) throw new AccountsError("Expense amount must be greater than 0.");

  const category = await ExpenseCategory.findOne({
    _id: params.data.categoryId,
    businessId: params.scope.businessId,
    isActive: true,
  });
  if (!category) throw new AccountsError("Expense category not found.", 404);

  const payNow = roundMoney(params.data.payNowAmount ?? 0);
  if (payNow > amount) {
    throw new AccountsError("Paid amount cannot exceed expense amount.");
  }

  if (payNow > 0) {
    if (!params.data.accountId) {
      throw new AccountsError("Select an account to pay from.");
    }
    if (!params.data.paymentMethod) {
      throw new AccountsError("Select a payment method.");
    }
  }

  return withMongoTransaction(async (session) => {
    const expenseNumber = await nextExpenseNumber(params.scope.businessId);
    const amountPaid = payNow;
    const balanceDue = roundMoney(amount - amountPaid);
    const status = paymentStatusOf(amount, amountPaid);

    const [expense] = await Expense.create(
      [
        {
          businessId: params.scope.businessId,
          storeId: params.scope.storeId,
          expenseNumber,
          title: params.data.title.trim(),
          categoryId: category._id,
          categoryName: category.name,
          amount,
          amountPaid,
          balanceDue,
          expenseDate: new Date(params.data.expenseDate),
          paymentDate: params.data.paymentDate
            ? new Date(params.data.paymentDate)
            : payNow > 0
              ? new Date()
              : null,
          paymentMethod: params.data.paymentMethod ?? null,
          accountId: params.data.accountId
            ? new Types.ObjectId(params.data.accountId)
            : null,
          paymentStatus: status,
          notes: (params.data.notes ?? "").trim(),
          attachmentUrl: (params.data.attachmentUrl ?? "").trim(),
          isReversed: false,
          createdBy: params.scope.performedBy ?? null,
        },
      ],
      { session },
    );

    if (payNow > 0 && params.data.accountId && params.data.paymentMethod) {
      const account = await FinancialAccount.findOne({
        _id: params.data.accountId,
        businessId: params.scope.businessId,
        isActive: true,
      }).session(session);
      if (!account) throw new AccountsError("Account not found.", 404);

      const paymentNumber = await nextDailySequence(
        (prefix) =>
          ExpensePayment.countDocuments({
            businessId: params.scope.businessId,
            paymentNumber: { $regex: `^${prefix}` },
          }).session(session),
        "EXPPAY",
      );

      const idempotencyKey =
        params.data.idempotencyKey?.trim() ||
        `expense-create-pay:${expense._id}`;

      const [payment] = await ExpensePayment.create(
        [
          {
            businessId: params.scope.businessId,
            storeId: params.scope.storeId,
            expenseId: expense._id,
            paymentNumber,
            amount: payNow,
            paymentMethod: params.data.paymentMethod,
            accountId: account._id,
            paymentDate: expense.paymentDate ?? new Date(),
            notes: "",
            idempotencyKey,
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
          entryType: "EXPENSE_PAYMENT",
          entryDate: payment.paymentDate,
          description: `Expense ${expense.expenseNumber}: ${expense.title}`,
          credit: payNow,
          referenceType: "EXPENSE_PAYMENT",
          referenceId: payment._id,
          referenceNumber: payment.paymentNumber,
          idempotencyKey: `expense-pay:${payment._id}`,
        },
      });
    }

    return expense;
  });
}

export async function payExpense(params: {
  scope: StockScope;
  expenseId: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  accountId: string;
  paymentDate?: string | Date;
  notes?: string;
  idempotencyKey: string;
}) {
  const amount = roundMoney(params.amount);
  if (amount <= 0) throw new AccountsError("Payment amount must be greater than 0.");

  return withMongoTransaction(async (session) => {
    const existingPay = await ExpensePayment.findOne({
      businessId: params.scope.businessId,
      idempotencyKey: params.idempotencyKey,
    }).session(session);
    if (existingPay) return existingPay;

    const expense = await Expense.findOne({
      _id: params.expenseId,
      businessId: params.scope.businessId,
      isReversed: false,
    }).session(session);
    if (!expense) throw new AccountsError("Expense not found.", 404);
    if (expense.balanceDue + 0.001 < amount) {
      throw new AccountsError("Payment exceeds outstanding expense balance.");
    }

    const account = await FinancialAccount.findOne({
      _id: params.accountId,
      businessId: params.scope.businessId,
      isActive: true,
    }).session(session);
    if (!account) throw new AccountsError("Account not found.", 404);

    const paymentNumber = await nextDailySequence(
      (prefix) =>
        ExpensePayment.countDocuments({
          businessId: params.scope.businessId,
          paymentNumber: { $regex: `^${prefix}` },
        }).session(session),
      "EXPPAY",
    );

    const [payment] = await ExpensePayment.create(
      [
        {
          businessId: params.scope.businessId,
          storeId: params.scope.storeId,
          expenseId: expense._id,
          paymentNumber,
          amount,
          paymentMethod: params.paymentMethod,
          accountId: account._id,
          paymentDate: params.paymentDate
            ? new Date(params.paymentDate)
            : new Date(),
          notes: (params.notes ?? "").trim(),
          idempotencyKey: params.idempotencyKey,
          createdBy: params.scope.performedBy ?? null,
        },
      ],
      { session },
    );

    expense.amountPaid = roundMoney(expense.amountPaid + amount);
    expense.balanceDue = roundMoney(expense.amount - expense.amountPaid);
    expense.paymentStatus = paymentStatusOf(expense.amount, expense.amountPaid);
    expense.paymentDate = payment.paymentDate;
    expense.paymentMethod = params.paymentMethod;
    expense.accountId = account._id;
    await expense.save({ session });

    await postAccountTransaction({
      scope: params.scope,
      session,
      input: {
        accountId: account._id,
        entryType: "EXPENSE_PAYMENT",
        entryDate: payment.paymentDate,
        description: `Expense ${expense.expenseNumber}: ${expense.title}`,
        credit: amount,
        referenceType: "EXPENSE_PAYMENT",
        referenceId: payment._id,
        referenceNumber: payment.paymentNumber,
        idempotencyKey: `expense-pay:${payment._id}`,
      },
    });

    return payment;
  });
}

export async function reverseExpense(params: {
  scope: StockScope;
  expenseId: string;
}) {
  return withMongoTransaction(async (session) => {
    const expense = await Expense.findOne({
      _id: params.expenseId,
      businessId: params.scope.businessId,
    }).session(session);
    if (!expense) throw new AccountsError("Expense not found.", 404);
    if (expense.isReversed) {
      throw new AccountsError("Expense is already reversed.", 409);
    }

    const payments = await ExpensePayment.find({
      businessId: params.scope.businessId,
      expenseId: expense._id,
      isReversed: false,
    }).session(session);

    for (const payment of payments) {
      await postAccountTransaction({
        scope: params.scope,
        session,
        input: {
          accountId: payment.accountId,
          entryType: "REVERSAL",
          entryDate: new Date(),
          description: `Reversal of expense payment ${payment.paymentNumber}`,
          debit: payment.amount,
          referenceType: "EXPENSE_PAYMENT",
          referenceId: payment._id,
          referenceNumber: payment.paymentNumber,
          idempotencyKey: `expense-pay-rev:${payment._id}`,
        },
      });
      payment.isReversed = true;
      await payment.save({ session });
    }

    expense.isReversed = true;
    expense.reversedAt = new Date();
    expense.paymentStatus = "PENDING";
    expense.amountPaid = 0;
    expense.balanceDue = expense.amount;
    await expense.save({ session });
    return expense;
  });
}

export async function sumOperatingExpenses(params: {
  businessId: Types.ObjectId;
  from: Date;
  to: Date;
}) {
  const rows = await Expense.aggregate<{ total: number }>([
    {
      $match: {
        businessId: params.businessId,
        isReversed: false,
        expenseDate: { $gte: params.from, $lt: params.to },
      },
    },
    { $group: { _id: null, total: { $sum: "$amount" } } },
  ]);
  return roundMoney(rows[0]?.total ?? 0);
}

export async function expenseBreakdownByCategory(params: {
  businessId: Types.ObjectId;
  from: Date;
  to: Date;
}) {
  return Expense.aggregate<{
    _id: Types.ObjectId;
    categoryName: string;
    total: number;
  }>([
    {
      $match: {
        businessId: params.businessId,
        isReversed: false,
        expenseDate: { $gte: params.from, $lt: params.to },
      },
    },
    {
      $group: {
        _id: "$categoryId",
        categoryName: { $first: "$categoryName" },
        total: { $sum: "$amount" },
      },
    },
    { $sort: { total: -1 } },
  ]);
}
