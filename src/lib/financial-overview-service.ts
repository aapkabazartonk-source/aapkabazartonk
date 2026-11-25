import {
  expenseBreakdownByCategory,
  sumOperatingExpenses,
} from "@/lib/expense-service";
import { accountBalances } from "@/lib/accounts-service";
import { sumRecognizedSalaryExpense } from "@/lib/staff-salary-service";
import { compareNumbers, RETURNS_NOTE } from "@/lib/analytics/finance";
import {
  loadHeader,
  loadPayables,
  loadProfit,
  type AnalyticsScope,
} from "@/lib/analytics/loaders";
import {
  BUSINESS_TIMEZONE,
  bucketLabel,
  resolveRange,
  type AnalyticsPreset,
} from "@/lib/analytics/time";
import { roundMoney } from "@/lib/money";
import { AccountTransaction } from "@/models/AccountTransaction";
import { Payment } from "@/models/Payment";

export const FINANCE_PRESETS = [
  "today",
  "last_7_days",
  "this_month",
  "last_30_days",
  "this_year",
  "last_month",
  "custom",
] as const;

export type FinancePreset = (typeof FINANCE_PRESETS)[number];

function toAnalyticsPreset(preset: FinancePreset): AnalyticsPreset {
  if (preset === "this_year" || preset === "last_month" || preset === "custom") {
    return "this_month";
  }
  if (preset === "last_7_days") return "last_7_days";
  if (preset === "last_30_days") return "last_30_days";
  if (preset === "today") return "today";
  return "this_month";
}

async function buildMonthlyProfitTrend(
  scope: AnalyticsScope,
  months: number,
  now = new Date(),
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  const points: Array<{
    key: string;
    label: string;
    netSales: number;
    operatingExpenses: number;
    operatingProfit: number | null;
  }> = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    let pointYear = year;
    let pointMonth = month - index;
    while (pointMonth <= 0) {
      pointMonth += 12;
      pointYear -= 1;
    }
    const nextMonth = pointMonth === 12 ? 1 : pointMonth + 1;
    const nextYear = pointMonth === 12 ? pointYear + 1 : pointYear;
    const from = new Date(
      `${pointYear}-${String(pointMonth).padStart(2, "0")}-01T00:00:00+05:30`,
    );
    const to = new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+05:30`,
    );
    const key = `${pointYear}-${String(pointMonth).padStart(2, "0")}`;
    const [header, profit, operatingExpenses, salaryExpense] =
      await Promise.all([
        loadHeader(scope, from, to),
        loadProfit(scope, from, to),
        sumOperatingExpenses({
          businessId: scope.businessId,
          from,
          to,
        }),
        sumRecognizedSalaryExpense({
          businessId: scope.businessId,
          from,
          to,
        }),
      ]);
    const totalOpEx = roundMoney(operatingExpenses + salaryExpense);
    const gross = profit.profit.grossProfit;
    points.push({
      key,
      label: bucketLabel(key, "month"),
      netSales: header.netSales,
      operatingExpenses: totalOpEx,
      operatingProfit:
        gross === null ? null : roundMoney(gross - totalOpEx),
    });
  }

  return points;
}

export function resolveFinanceRange(params: {
  preset: FinancePreset;
  from?: string | null;
  to?: string | null;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  if (params.preset === "custom") {
    if (!params.from || !params.to) {
      throw new Error("Choose a custom start and end date.");
    }
    const from = new Date(params.from);
    const to = new Date(params.to);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error("Enter a valid custom date range.");
    }
    const end = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      end.setHours(23, 59, 59, 999);
    }
    return {
      from,
      to: end,
      label: "Custom range",
      previousFrom: from,
      previousTo: from,
      previousLabel: "—",
    };
  }

  if (params.preset === "this_year") {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
    }).formatToParts(now);
    const year = parts.find((p) => p.type === "year")?.value ?? "2026";
    const from = new Date(`${year}-01-01T00:00:00+05:30`);
    return {
      from,
      to: now,
      label: `Year ${year}`,
      previousFrom: new Date(`${Number(year) - 1}-01-01T00:00:00+05:30`),
      previousTo: from,
      previousLabel: `Year ${Number(year) - 1}`,
    };
  }

  if (params.preset === "last_month") {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const year = Number(parts.find((p) => p.type === "year")?.value);
    const month = Number(parts.find((p) => p.type === "month")?.value);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const from = new Date(
      `${prevYear}-${String(prevMonth).padStart(2, "0")}-01T00:00:00+05:30`,
    );
    const to = new Date(
      `${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`,
    );
    return {
      from,
      to,
      label: "Last month",
      previousFrom: from,
      previousTo: from,
      previousLabel: "—",
    };
  }

  return resolveRange({
    preset: toAnalyticsPreset(params.preset),
    now,
  });
}

export async function getFinancialOverview(
  scope: AnalyticsScope,
  params: {
    preset: FinancePreset;
    from?: string | null;
    to?: string | null;
  },
) {
  const range = resolveFinanceRange(params);
  const analyticsScope = {
    businessId: scope.businessId,
    storeId: scope.storeId,
  };

  const [
    header,
    previousHeader,
    profit,
    previousProfit,
    operatingExpenses,
    previousOperatingExpenses,
    salaryExpense,
    previousSalaryExpense,
    balances,
    payables,
    expenseBreakdown,
    ownerWithdrawals,
    recentTxns,
  ] = await Promise.all([
    loadHeader(analyticsScope, range.from, range.to),
    loadHeader(analyticsScope, range.previousFrom, range.previousTo),
    loadProfit(analyticsScope, range.from, range.to),
    loadProfit(analyticsScope, range.previousFrom, range.previousTo),
    sumOperatingExpenses({
      businessId: scope.businessId,
      from: range.from,
      to: range.to,
    }),
    sumOperatingExpenses({
      businessId: scope.businessId,
      from: range.previousFrom,
      to: range.previousTo,
    }),
    sumRecognizedSalaryExpense({
      businessId: scope.businessId,
      from: range.from,
      to: range.to,
    }),
    sumRecognizedSalaryExpense({
      businessId: scope.businessId,
      from: range.previousFrom,
      to: range.previousTo,
    }),
    accountBalances(scope.businessId),
    loadPayables(analyticsScope),
    expenseBreakdownByCategory({
      businessId: scope.businessId,
      from: range.from,
      to: range.to,
    }),
    AccountTransaction.aggregate<{ total: number }>([
      {
        $match: {
          businessId: scope.businessId,
          entryType: "OWNER_WITHDRAWAL",
          entryDate: { $gte: range.from, $lt: range.to },
        },
      },
      { $group: { _id: null, total: { $sum: "$credit" } } },
    ]),
    AccountTransaction.find({
      businessId: scope.businessId,
    })
      .sort({ entryDate: -1, createdAt: -1 })
      .limit(12)
      .lean(),
  ]);

  const totalOperatingExpenses = roundMoney(
    operatingExpenses + salaryExpense,
  );
  const previousTotalOperating = roundMoney(
    previousOperatingExpenses + previousSalaryExpense,
  );

  const grossProfit = profit.profit.grossProfit;
  const previousGross = previousProfit.profit.grossProfit;
  const operatingProfit =
    grossProfit === null
      ? null
      : roundMoney(grossProfit - totalOperatingExpenses);
  const previousOperatingProfit =
    previousGross === null
      ? null
      : roundMoney(previousGross - previousTotalOperating);

  const paymentMethods = await Payment.aggregate<{
    _id: string;
    amount: number;
  }>([
    {
      $match: {
        businessId: scope.businessId,
        storeId: scope.storeId,
        createdAt: { $gte: range.from, $lt: range.to },
        status: { $in: ["CONFIRMED", "MANUALLY_CONFIRMED"] },
      },
    },
    { $group: { _id: "$paymentMethod", amount: { $sum: "$amount" } } },
    { $sort: { amount: -1 } },
  ]);

  const monthlyProfitTrend = await buildMonthlyProfitTrend(analyticsScope, 6);

  return {
    generatedAt: new Date().toISOString(),
    timezone: BUSINESS_TIMEZONE,
    range: {
      preset: params.preset,
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
      previousLabel: range.previousLabel,
    },
    notes: {
      returns: RETURNS_NOTE,
      cogs: profit.profit.status,
      costNote:
        "COGS uses estimated weighted average purchase cost. Opening stock without purchase history may leave some sales uncovered.",
      cashVsProfit:
        "Cash and bank balances are funds on hand. Operating profit is an accounting result and is not the same as cash.",
      ownerWithdrawals:
        "Owner withdrawals reduce cash/bank but are not operating expenses.",
      openingBalances:
        "Account balances start at configured opening balances. Historical POS payments before Accounts setup are not backfilled automatically.",
    },
    kpis: {
      netSales: compareNumbers(header.netSales, previousHeader.netSales),
      grossProfit: compareNumbers(grossProfit, previousGross),
      operatingExpenses: compareNumbers(
        totalOperatingExpenses,
        previousTotalOperating,
      ),
      staffSalaryExpenses: compareNumbers(salaryExpense, previousSalaryExpense),
      operatingProfit: compareNumbers(
        operatingProfit,
        previousOperatingProfit,
      ),
      cashInHand: compareNumbers(balances.cashInHand, null),
      bankBalance: compareNumbers(
        roundMoney(balances.bankBalance + balances.upiBalance),
        null,
      ),
      supplierPayables: compareNumbers(payables, null),
      ownerWithdrawals: compareNumbers(
        roundMoney(ownerWithdrawals[0]?.total ?? 0),
        null,
      ),
    },
    charts: {
      revenueVsExpenses: {
        revenue: header.netSales,
        operatingExpenses: totalOperatingExpenses,
      },
      grossVsOperating: {
        grossProfit: grossProfit ?? 0,
        operatingExpenses: totalOperatingExpenses,
      },
      monthlyProfitTrend,
      expenseBreakdown: expenseBreakdown.map((row) => ({
        categoryId: String(row._id),
        categoryName: row.categoryName,
        total: roundMoney(row.total),
      })),
      paymentMethods: paymentMethods.map((row) => ({
        method: row._id,
        amount: roundMoney(row.amount),
      })),
    },
    balances: {
      cashInHand: balances.cashInHand,
      bankBalance: balances.bankBalance,
      upiBalance: balances.upiBalance,
      totalFunds: balances.total,
    },
    recentTransactions: recentTxns.map((row) => ({
      _id: String(row._id),
      transactionNumber: row.transactionNumber,
      entryType: row.entryType,
      entryDate: row.entryDate.toISOString(),
      description: row.description,
      debit: row.debit,
      credit: row.credit,
      referenceType: row.referenceType,
      referenceNumber: row.referenceNumber,
      accountId: String(row.accountId),
    })),
  };
}

export async function getAccountsProfitLoss(
  scope: AnalyticsScope,
  params: {
    preset: FinancePreset;
    from?: string | null;
    to?: string | null;
  },
) {
  const range = resolveFinanceRange(params);
  const analyticsScope = {
    businessId: scope.businessId,
    storeId: scope.storeId,
  };

  const [header, profit, operatingExpenses, salaryExpense, breakdown] =
    await Promise.all([
      loadHeader(analyticsScope, range.from, range.to),
      loadProfit(analyticsScope, range.from, range.to),
      sumOperatingExpenses({
        businessId: scope.businessId,
        from: range.from,
        to: range.to,
      }),
      sumRecognizedSalaryExpense({
        businessId: scope.businessId,
        from: range.from,
        to: range.to,
      }),
      expenseBreakdownByCategory({
        businessId: scope.businessId,
        from: range.from,
        to: range.to,
      }),
    ]);

  const totalOpEx = roundMoney(operatingExpenses + salaryExpense);
  const gross = profit.profit.grossProfit;
  const operatingProfit =
    gross === null ? null : roundMoney(gross - totalOpEx);

  return {
    range: {
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      label: range.label,
    },
    netSales: header.netSales,
    revenueInclusive: header.revenue,
    gst: header.gst,
    cogs: profit.profit.cogs,
    grossProfit: gross,
    grossMargin: profit.profit.grossMargin,
    costStatus: profit.profit.status,
    operatingExpenses: {
      otherOperating: operatingExpenses,
      staffSalaries: salaryExpense,
      total: totalOpEx,
      breakdown: [
        ...breakdown.map((row) => ({
          name: row.categoryName,
          total: roundMoney(row.total),
        })),
        ...(salaryExpense > 0
          ? [{ name: "Staff Salaries", total: salaryExpense }]
          : []),
      ],
    },
    operatingProfit,
    limitations: [
      RETURNS_NOTE,
      "Operating profit excludes owner withdrawals, interest, depreciation, and income tax.",
      "COGS is estimated from received purchases (weighted average), not a sale-time cost snapshot.",
      "Unsold inventory purchases are not treated as operating expenses.",
    ],
  };
}
