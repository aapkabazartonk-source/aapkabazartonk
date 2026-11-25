import type { ComparedNumber } from "@/lib/analytics/finance";
import type {
  AccountTransactionType,
  ExpensePaymentMethod,
  ExpensePaymentStatus,
  FinancialAccountType,
  SalaryPaymentMethod,
  SalaryRecordStatus,
} from "@/lib/constants";

export const FINANCE_PRESET_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
] as const;

export type FinancePreset = (typeof FINANCE_PRESET_OPTIONS)[number]["value"];

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/* ---------------------------- Financial overview --------------------------- */

export interface AccountTransactionRecord {
  _id: string;
  transactionNumber: string;
  entryType: AccountTransactionType;
  entryDate: string;
  description: string;
  debit: number;
  credit: number;
  referenceType?: string;
  referenceNumber?: string;
  accountId: string;
  /** Present on ledger responses when the API computes it. */
  runningBalance?: number;
}

export interface FinancialOverviewResponse {
  generatedAt: string;
  range: {
    preset: string;
    from: string;
    to: string;
    label: string;
    previousLabel: string;
  };
  notes: {
    returns: string;
    cogs: string;
    costNote: string;
    cashVsProfit: string;
    ownerWithdrawals: string;
    openingBalances: string;
  };
  kpis: {
    netSales: ComparedNumber;
    grossProfit: ComparedNumber;
    operatingExpenses: ComparedNumber;
    staffSalaryExpenses: ComparedNumber;
    operatingProfit: ComparedNumber;
    cashInHand: ComparedNumber;
    bankBalance: ComparedNumber;
    supplierPayables: ComparedNumber;
    ownerWithdrawals: ComparedNumber;
  };
  charts: {
    revenueVsExpenses: { revenue: number; operatingExpenses: number };
    grossVsOperating: { grossProfit: number; operatingExpenses: number };
    monthlyProfitTrend: Array<{
      key: string;
      label: string;
      netSales: number;
      operatingExpenses: number;
      operatingProfit: number | null;
    }>;
    expenseBreakdown: Array<{
      categoryId: string;
      categoryName: string;
      total: number;
    }>;
    paymentMethods: Array<{ method: string; amount: number }>;
  };
  balances: {
    cashInHand: number;
    bankBalance: number;
    upiBalance: number;
    totalFunds: number;
  };
  recentTransactions: AccountTransactionRecord[];
}

/* -------------------------------- Profit & loss ---------------------------- */

export interface ProfitLossResponse {
  range: { from: string; to: string; label: string };
  netSales: number;
  revenueInclusive: number;
  gst: number;
  cogs: number | null;
  grossProfit: number | null;
  grossMargin: number | null;
  costStatus: string;
  operatingExpenses: {
    otherOperating: number;
    staffSalaries: number;
    total: number;
    breakdown: Array<{ name: string; total: number }>;
  };
  operatingProfit: number | null;
  limitations: string[];
}

/* ---------------------------------- Accounts ------------------------------- */

export interface FinancialAccountRecord {
  _id: string;
  name: string;
  accountType: FinancialAccountType;
  linkedPaymentMethod?: string | null;
  openingBalance: number;
  currentBalance: number;
  allowNegative: boolean;
  isDefault: boolean;
  isActive: boolean;
  notes?: string;
}

export interface AccountListResponse {
  data: FinancialAccountRecord[];
}

export interface AccountLedgerResponse {
  account?: FinancialAccountRecord;
  data: AccountTransactionRecord[];
  pagination: Pagination;
}

/* ---------------------------------- Expenses ------------------------------- */

export interface ExpenseCategoryRecord {
  _id: string;
  name: string;
  isSystem?: boolean;
  isActive: boolean;
}

export interface ExpenseRecord {
  _id: string;
  expenseNumber: string;
  title: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
  expenseDate: string;
  paymentDate?: string | null;
  paymentMethod?: ExpensePaymentMethod | null;
  accountId?: string | null;
  paymentStatus: ExpensePaymentStatus;
  notes?: string;
  isReversed: boolean;
}

export interface ExpenseStats {
  totalExpenses?: number;
  paidExpenses?: number;
  pendingExpenses?: number;
  count?: number;
}

export interface ExpenseListResponse {
  data: ExpenseRecord[];
  pagination: Pagination;
  stats?: ExpenseStats;
}

/* ------------------------------------ Staff -------------------------------- */

export interface StaffRecord {
  _id: string;
  name: string;
  phone?: string;
  designation?: string;
  joiningDate: string;
  monthlySalary: number;
  paymentPreference: SalaryPaymentMethod;
  isActive: boolean;
  notes?: string;
  /** Outstanding advance balance, when the API includes it. */
  advanceBalance?: number;
}

export interface SalaryRecordRow {
  _id: string;
  staffId: string;
  staffName: string;
  period: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  advanceAdjusted: number;
  netPayable: number;
  amountPaid: number;
  balanceDue: number;
  status: SalaryRecordStatus;
}

export interface StaffStats {
  activeStaff?: number;
  monthlyCommitment?: number;
  salaryPaidThisPeriod?: number;
  salaryPendingThisPeriod?: number;
}

export interface StaffListResponse {
  data: StaffRecord[];
  /** Salary records for the requested period (and any unpaid ones). */
  salaryRecords?: SalaryRecordRow[];
  stats?: StaffStats;
}
