"use client";

/* Data-fetch effects intentionally sync remote account lists into local state. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import {
  FINANCE_PRESET_OPTIONS,
  type AccountListResponse,
  type FinancePreset,
  type FinancialAccountRecord,
} from "@/types/accounts";

export const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CARD: "Card",
  OTHER: "Other",
};

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank",
  UPI: "UPI",
};

export const ENTRY_TYPE_LABELS: Record<string, string> = {
  OPENING: "Opening",
  SALE_COLLECTION: "Sale collection",
  SUPPLIER_PAYMENT: "Supplier payment",
  EXPENSE_PAYMENT: "Expense payment",
  SALARY_PAYMENT: "Salary payment",
  OWNER_WITHDRAWAL: "Owner withdrawal",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
  REVERSAL: "Reversal",
};

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

/** Local `YYYY-MM-DD` for `<input type="date" />`. */
export function todayInput() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Current `YYYY-MM` for salary periods. */
export function currentPeriod() {
  return todayInput().slice(0, 7);
}

export function formatPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  if (!year || !month) return period;
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}

export function parseAmount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function FormField({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FinancePresetSelect({
  value,
  onValueChange,
  disabled,
  customFrom,
  customTo,
  onCustomFromChange,
  onCustomToChange,
}: {
  value: FinancePreset;
  onValueChange: (value: FinancePreset) => void;
  disabled?: boolean;
  customFrom?: string;
  customTo?: string;
  onCustomFromChange?: (value: string) => void;
  onCustomToChange?: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={value}
        onValueChange={(next) => onValueChange(next as FinancePreset)}
        disabled={disabled}
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent>
          {FINANCE_PRESET_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value === "custom" ? (
        <>
          <input
            type="date"
            value={customFrom ?? ""}
            onChange={(event) => onCustomFromChange?.(event.target.value)}
            disabled={disabled}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={customTo ?? ""}
            onChange={(event) => onCustomToChange?.(event.target.value)}
            disabled={disabled}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          />
        </>
      ) : null}
    </div>
  );
}

export function AccountSelect({
  accounts,
  value,
  onValueChange,
  id,
  placeholder = "Select account",
  excludeId,
}: {
  accounts: FinancialAccountRecord[];
  value: string;
  onValueChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  excludeId?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="rounded-xl">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts
          .filter((account) => account._id !== excludeId)
          .map((account) => (
            <SelectItem key={account._id} value={account._id}>
              {account.name} · {ACCOUNT_TYPE_LABELS[account.accountType]}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}

export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-danger-soft/50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-destructive">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

/** Active financial accounts for pay-from / pay-to selectors. */
export function useAccountOptions() {
  const [accounts, setAccounts] = useState<FinancialAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useEffectEvent(async () => {
    try {
      const response = await fetchJson<AccountListResponse>(
        "/api/accounts/accounts",
        { cache: "no-store" },
      );
      setAccounts(response.data.filter((account) => account.isActive));
    } catch (error) {
      toast.error(errorMessage(error, "Could not load accounts."));
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void load();
  }, []);

  return { accounts, loading };
}

/** Prefer an account linked to the payment method; otherwise the first one. */
export function defaultAccountFor(
  accounts: FinancialAccountRecord[],
  method: string,
) {
  const linked = accounts.find(
    (account) => account.linkedPaymentMethod === method,
  );
  return (linked ?? accounts[0])?._id ?? "";
}
