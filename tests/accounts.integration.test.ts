import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, describe, it } from "node:test";
import { Types } from "mongoose";

function loadEnv() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

describe("accounts & expenses integration", { concurrency: 1 }, () => {
  after(async () => {
    const mongoose = await import("mongoose");
    await mongoose.disconnect();
  });

  it("covers expenses, salaries, withdrawals, transfers, and P&L integrity", async () => {
    const { connectToDatabase } = await import("../src/lib/db.ts");
    await connectToDatabase();

    const { Business } = await import("../src/models/Business.ts");
    const { Store } = await import("../src/models/Store.ts");
    const { FinancialAccount } = await import(
      "../src/models/FinancialAccount.ts"
    );
    const { Expense } = await import("../src/models/Expense.ts");
    const { ExpenseCategory } = await import(
      "../src/models/ExpenseCategory.ts"
    );
    const { ExpensePayment } = await import("../src/models/ExpensePayment.ts");
    const { Staff } = await import("../src/models/Staff.ts");
    const { SalaryRecord } = await import("../src/models/SalaryRecord.ts");
    const { SalaryPayment } = await import("../src/models/SalaryPayment.ts");
    const { StaffAdvance } = await import("../src/models/StaffAdvance.ts");
    const { AccountTransaction } = await import(
      "../src/models/AccountTransaction.ts"
    );
    const {
      ensureDefaultExpenseCategories,
      createExpense,
      payExpense,
      reverseExpense,
      sumOperatingExpenses,
    } = await import("../src/lib/expense-service.ts");
    const {
      createStaff,
      createSalaryRecord,
      paySalary,
      sumRecognizedSalaryExpense,
    } = await import("../src/lib/staff-salary-service.ts");
    const {
      ensureDefaultAccounts,
    } = await import("../src/lib/account-ledger.ts");
    const {
      createAccount,
      recordOwnerWithdrawal,
      transferBetweenAccounts,
      accountBalances,
    } = await import("../src/lib/accounts-service.ts");
    const {
      getFinancialOverview,
      getAccountsProfitLoss,
    } = await import("../src/lib/financial-overview-service.ts");
    const { AccountsError } = await import("../src/lib/accounts-error.ts");

    const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
    const business = await Business.create({
      name: `Accounts ${stamp}`,
      code: `A${stamp}`.slice(0, 40),
      isActive: true,
    });
    const store = await Store.create({
      businessId: business._id,
      name: "Main",
      code: "MAIN",
      isDefault: true,
      isActive: true,
    });
    const scope = {
      businessId: business._id,
      storeId: store._id,
      performedBy: null as Types.ObjectId | null,
    };

    try {
      await ensureDefaultAccounts(scope);
      await ensureDefaultExpenseCategories(business._id);

      const cash = await FinancialAccount.findOne({
        businessId: business._id,
        linkedPaymentMethod: "CASH",
        isActive: true,
      });
      assert.ok(cash);

      // Seed opening cash via deposit-style opening on a dedicated account.
      const floatAccount = await createAccount({
        scope,
        data: {
          name: `Float ${stamp}`,
          accountType: "CASH",
          openingBalance: 50_000,
          allowNegative: false,
        },
      });

      const rentCategory = await ExpenseCategory.findOne({
        businessId: business._id,
        normalizedName: "rent",
      });
      assert.ok(rentCategory);

      // 1 + 2. Pending rent expense should not move cash until paid.
      const pending = await createExpense({
        scope,
        data: {
          title: `Rent pending ${stamp}`,
          categoryId: String(rentCategory._id),
          amount: 10_000,
          expenseDate: "2026-11-01",
          payNowAmount: 0,
        },
      });
      assert.equal(pending.paymentStatus, "PENDING");
      assert.equal(pending.balanceDue, 10_000);

      const beforePay = await FinancialAccount.findById(floatAccount._id);
      assert.ok(beforePay);
      assert.equal(beforePay.currentBalance, 50_000);

      // 3. Pay pending expense and verify cash decreases.
      await payExpense({
        scope,
        expenseId: String(pending._id),
        amount: 10_000,
        paymentMethod: "CASH",
        accountId: String(floatAccount._id),
        paymentDate: "2026-11-05",
        idempotencyKey: `exp-pay-${stamp}`,
      });
      const afterPay = await FinancialAccount.findById(floatAccount._id);
      assert.ok(afterPay);
      assert.equal(afterPay.currentBalance, 40_000);

      const duplicatePay = await payExpense({
        scope,
        expenseId: String(pending._id),
        amount: 10_000,
        paymentMethod: "CASH",
        accountId: String(floatAccount._id),
        idempotencyKey: `exp-pay-${stamp}`,
      });
      assert.ok(duplicatePay);
      const afterDup = await FinancialAccount.findById(floatAccount._id);
      assert.ok(afterDup);
      assert.equal(afterDup.currentBalance, 40_000);

      // 4–6. Staff salary recognition once, partial pay, advance adjust.
      const staff = await createStaff({
        scope,
        data: {
          name: `Clerk ${stamp}`,
          joiningDate: "2026-01-01",
          monthlySalary: 12_000,
          paymentPreference: "CASH",
        },
      });

      await paySalary({
        scope,
        data: {
          staffId: String(staff._id),
          paymentKind: "ADVANCE",
          amount: 2_000,
          paymentMethod: "CASH",
          accountId: String(floatAccount._id),
          paymentDate: "2026-10-28",
          idempotencyKey: `adv-${stamp}`,
        },
      });

      const salary = await createSalaryRecord({
        scope,
        data: {
          staffId: String(staff._id),
          period: "2026-11",
          bonus: 0,
          deductions: 0,
        },
      });
      assert.equal(salary.advanceAdjusted, 2_000);
      assert.equal(salary.netPayable, 10_000);
      assert.equal(salary.balanceDue, 10_000);

      await assert.rejects(
        () =>
          createSalaryRecord({
            scope,
            data: {
              staffId: String(staff._id),
              period: "2026-11",
            },
          }),
        (error: unknown) =>
          error instanceof AccountsError && error.status === 409,
      );

      await paySalary({
        scope,
        data: {
          staffId: String(staff._id),
          salaryRecordId: String(salary._id),
          paymentKind: "REGULAR",
          amount: 4_000,
          paymentMethod: "CASH",
          accountId: String(floatAccount._id),
          paymentDate: "2026-11-07",
          idempotencyKey: `sal-partial-${stamp}`,
        },
      });
      const partial = await SalaryRecord.findById(salary._id);
      assert.ok(partial);
      assert.equal(partial.status, "PARTIAL");
      assert.equal(partial.balanceDue, 6_000);

      // 7. Owner withdrawal reduces cash but not operating expenses.
      const beforeWithdrawal = await FinancialAccount.findById(floatAccount._id);
      assert.ok(beforeWithdrawal);
      await recordOwnerWithdrawal({
        scope,
        data: {
          accountId: String(floatAccount._id),
          amount: 1_000,
          entryDate: "2026-11-08",
          description: "Owner drawings",
          idempotencyKey: `ow-${stamp}`,
        },
      });
      const afterWithdrawal = await FinancialAccount.findById(floatAccount._id);
      assert.ok(afterWithdrawal);
      assert.equal(
        afterWithdrawal.currentBalance,
        beforeWithdrawal.currentBalance - 1_000,
      );

      const opex = await sumOperatingExpenses({
        businessId: business._id,
        from: new Date("2026-11-01T00:00:00+05:30"),
        to: new Date("2026-12-01T00:00:00+05:30"),
      });
      const salaryExpense = await sumRecognizedSalaryExpense({
        businessId: business._id,
        from: new Date("2026-11-01T00:00:00+05:30"),
        to: new Date("2026-12-01T00:00:00+05:30"),
      });
      assert.equal(opex, 10_000);
      assert.equal(salaryExpense, 12_000);

      const pnl = await getAccountsProfitLoss(
        { businessId: business._id, storeId: store._id },
        {
          preset: "custom",
          from: "2026-11-01",
          to: "2026-11-30",
        },
      );
      assert.equal(pnl.operatingExpenses.otherOperating, 10_000);
      assert.equal(pnl.operatingExpenses.staffSalaries, 12_000);
      assert.ok(
        pnl.limitations.some((note) =>
          note.toLowerCase().includes("owner withdrawals"),
        ),
      );

      // 14. Transfer keeps total funds unchanged.
      const bank = await FinancialAccount.findOne({
        businessId: business._id,
        linkedPaymentMethod: "BANK_TRANSFER",
        isActive: true,
      });
      assert.ok(bank);
      const balancesBefore = await accountBalances(business._id);
      await transferBetweenAccounts({
        scope,
        data: {
          fromAccountId: String(floatAccount._id),
          toAccountId: String(bank._id),
          amount: 500,
          entryDate: "2026-11-09",
          idempotencyKey: `xfer-${stamp}`,
        },
      });
      const balancesAfter = await accountBalances(business._id);
      assert.equal(balancesAfter.total, balancesBefore.total);

      const overview = await getFinancialOverview(
        { businessId: business._id, storeId: store._id },
        {
          preset: "custom",
          from: "2026-11-01",
          to: "2026-11-30",
        },
      );
      assert.equal(overview.kpis.operatingExpenses.current, 22_000);
      assert.equal(overview.kpis.ownerWithdrawals.current, 1_000);
      assert.ok(overview.charts.monthlyProfitTrend.length >= 1);

      // Reverse expense restores cash via reversal ledger entry.
      const beforeReverse = await FinancialAccount.findById(floatAccount._id);
      assert.ok(beforeReverse);
      await reverseExpense({
        scope,
        expenseId: String(pending._id),
      });
      const afterReverse = await FinancialAccount.findById(floatAccount._id);
      assert.ok(afterReverse);
      assert.equal(afterReverse.currentBalance, beforeReverse.currentBalance + 10_000);
    } finally {
      await Promise.all([
        AccountTransaction.collection.deleteMany({ businessId: business._id }),
        ExpensePayment.deleteMany({ businessId: business._id }),
        Expense.deleteMany({ businessId: business._id }),
        ExpenseCategory.deleteMany({ businessId: business._id }),
        SalaryPayment.deleteMany({ businessId: business._id }),
        SalaryRecord.deleteMany({ businessId: business._id }),
        StaffAdvance.deleteMany({ businessId: business._id }),
        Staff.deleteMany({ businessId: business._id }),
        FinancialAccount.deleteMany({ businessId: business._id }),
        Store.deleteMany({ _id: store._id }),
        Business.deleteMany({ _id: business._id }),
      ]);
    }
  });
});
