"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Landmark,
  Loader2,
  LogOut,
  MoreHorizontal,
  Plus,
  Smartphone,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  ACCOUNT_TYPE_LABELS,
  AccountSelect,
  ENTRY_TYPE_LABELS,
  FormField,
  errorMessage,
  formatDate,
  newIdempotencyKey,
  parseAmount,
  todayInput,
} from "@/components/accounts/accounts-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationControls } from "@/components/shared/pagination-controls";
import { SimpleStatCard } from "@/components/shared/simple-stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  FINANCIAL_ACCOUNT_TYPES,
  type FinancialAccountType,
} from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import { formatCurrency } from "@/lib/utils";
import type {
  AccountLedgerResponse,
  AccountListResponse,
  FinancialAccountRecord,
} from "@/types/accounts";

type MovementKind = "deposit" | "withdraw" | "transfer" | "owner-withdrawal";

const MOVEMENT_COPY: Record<
  MovementKind,
  { title: string; description: string; submit: string; success: string }
> = {
  deposit: {
    title: "Deposit funds",
    description: "Add money to an account, for example owner capital or bank deposit.",
    submit: "Record deposit",
    success: "Deposit recorded",
  },
  withdraw: {
    title: "Withdraw funds",
    description: "Take money out of an account without recording an expense.",
    submit: "Record withdrawal",
    success: "Withdrawal recorded",
  },
  transfer: {
    title: "Transfer between accounts",
    description: "Move money, such as cash to bank. Total funds stay the same.",
    submit: "Transfer funds",
    success: "Transfer recorded",
  },
  "owner-withdrawal": {
    title: "Owner withdrawal",
    description:
      "Record drawings. This reduces funds but is not an operating expense.",
    submit: "Record withdrawal",
    success: "Owner withdrawal recorded",
  },
};

type SheetState =
  | { type: "movement"; kind: MovementKind; accountId?: string }
  | { type: "account" };

/* ------------------------------ Movement form ------------------------------ */

function MovementForm({
  kind,
  accounts,
  initialAccountId,
  onSaved,
  onCancel,
}: {
  kind: MovementKind;
  accounts: FinancialAccountRecord[];
  initialAccountId?: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [selectedAccountId, setAccountId] = useState(initialAccountId ?? "");
  const accountId = selectedAccountId || accounts[0]?._id || "";
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayInput);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const copy = MOVEMENT_COPY[kind];
  const isTransfer = kind === "transfer";
  const source = accounts.find((account) => account._id === accountId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (!accountId) return toast.error("Select an account.");
    if (value <= 0) return toast.error("Enter an amount greater than 0.");
    if (isTransfer) {
      if (!toAccountId) return toast.error("Select a destination account.");
      if (toAccountId === accountId) {
        return toast.error("Choose two different accounts.");
      }
    }

    setSaving(true);
    try {
      await fetchJson(`/api/accounts/accounts/${kind}`, {
        method: "POST",
        body: JSON.stringify(
          isTransfer
            ? {
                fromAccountId: accountId,
                toAccountId,
                amount: value,
                entryDate,
                description: description.trim(),
                idempotencyKey,
              }
            : {
                accountId,
                amount: value,
                entryDate,
                description: description.trim(),
                idempotencyKey,
              },
        ),
      });
      toast.success(copy.success);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not record movement."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField
        label={isTransfer ? "From account" : "Account"}
        hint={
          source
            ? `Current balance ${formatCurrency(source.currentBalance)}`
            : undefined
        }
      >
        <AccountSelect
          accounts={accounts}
          value={accountId}
          onValueChange={setAccountId}
        />
      </FormField>

      {isTransfer ? (
        <FormField label="To account">
          <AccountSelect
            accounts={accounts}
            value={toAccountId}
            onValueChange={setToAccountId}
            excludeId={accountId}
            placeholder="Select destination"
          />
        </FormField>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" htmlFor="mv-amount">
          <Input
            id="mv-amount"
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Date" htmlFor="mv-date">
          <Input
            id="mv-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="Description" htmlFor="mv-description">
        <Textarea
          id="mv-description"
          rows={3}
          placeholder="Optional note"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            copy.submit
          )}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------ Account form ------------------------------- */

function AccountForm({
  onSaved,
  onCancel,
}: {
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<FinancialAccountType>("BANK");
  const [openingBalance, setOpeningBalance] = useState("");
  const [allowNegative, setAllowNegative] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Enter an account name.");

    setSaving(true);
    try {
      await fetchJson("/api/accounts/accounts", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          accountType,
          openingBalance: parseAmount(openingBalance),
          allowNegative,
          notes: notes.trim(),
        }),
      });
      toast.success("Account created");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not create account."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField label="Account name" htmlFor="acc-name">
        <Input
          id="acc-name"
          placeholder="e.g. HDFC Current Account"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Type">
          <Select
            value={accountType}
            onValueChange={(value) =>
              setAccountType(value as FinancialAccountType)
            }
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FINANCIAL_ACCOUNT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Opening balance" htmlFor="acc-opening">
          <Input
            id="acc-opening"
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </FormField>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
        <div>
          <p className="text-sm font-medium">Allow negative balance</p>
          <p className="text-xs text-muted-foreground">
            Useful for overdraft accounts.
          </p>
        </div>
        <Switch checked={allowNegative} onCheckedChange={setAllowNegative} />
      </div>
      <FormField label="Notes" htmlFor="acc-notes">
        <Textarea
          id="acc-notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </FormField>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </div>
    </form>
  );
}

/* --------------------------------- Manager --------------------------------- */

export function CashbookManager() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<FinancialAccountRecord[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [ledger, setLedger] = useState<AccountLedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerReload, setLedgerReload] = useState(0);
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const loadAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchJson<AccountListResponse>(
        "/api/accounts/accounts",
        { cache: "no-store" },
      );
      setAccounts(response.data);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load accounts."));
    } finally {
      setLoading(false);
    }
  }, []);

  async function toggleAccountActive(account: FinancialAccountRecord) {
    try {
      await fetchJson(`/api/accounts/accounts/${account._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      toast.success(
        account.isActive ? "Account deactivated" : "Account activated",
      );
      await loadAccounts();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update account."));
    }
  }

  const onLoadAccounts = useEffectEvent(() => {
    void loadAccounts();
  });

  useEffect(() => {
    onLoadAccounts();
  }, []);

  const activeAccounts = accounts.filter((account) => account.isActive);
  const effectiveSelectedId =
    selectedId && accounts.some((account) => account._id === selectedId)
      ? selectedId
      : (activeAccounts[0]?._id ?? "");

  const loadLedger = useEffectEvent(
    async (accountId: string, page: number) => {
      setLedgerLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: "15",
        });
        const response = await fetchJson<AccountLedgerResponse>(
          `/api/accounts/accounts/${accountId}/ledger?${params.toString()}`,
          { cache: "no-store" },
        );
        setLedger(response);
      } catch (error) {
        setLedger(null);
        toast.error(errorMessage(error, "Failed to load ledger."));
      } finally {
        setLedgerLoading(false);
      }
    },
  );

  useEffect(() => {
    if (!effectiveSelectedId) return;
    void loadLedger(effectiveSelectedId, ledgerPage);
  }, [effectiveSelectedId, ledgerPage, ledgerReload]);

  function selectAccount(id: string) {
    setSelectedId(id);
    setLedgerPage(1);
  }

  async function handleSaved() {
    setSheet(null);
    setLedgerReload((value) => value + 1);
    await loadAccounts();
  }

  const totals = activeAccounts.reduce(
    (sum, account) => {
      sum.total += account.currentBalance;
      sum[account.accountType] += account.currentBalance;
      return sum;
    },
    { total: 0, CASH: 0, BANK: 0, UPI: 0 },
  );

  const selectedAccount = accounts.find(
    (account) => account._id === effectiveSelectedId,
  );
  const hasAccounts = activeAccounts.length > 0;

  const copy =
    sheet?.type === "movement" ? MOVEMENT_COPY[sheet.kind] : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts & Cashbook"
        description="Cash, bank, and UPI balances with a ledger for every movement."
        actions={
          <>
            <Button
              variant="outline"
              disabled={!hasAccounts}
              onClick={() => setSheet({ type: "movement", kind: "deposit" })}
            >
              <ArrowDownLeft className="h-4 w-4" />
              Deposit
            </Button>
            <Button
              variant="outline"
              disabled={!hasAccounts}
              onClick={() => setSheet({ type: "movement", kind: "withdraw" })}
            >
              <ArrowUpRight className="h-4 w-4" />
              Withdraw
            </Button>
            <Button
              variant="outline"
              disabled={activeAccounts.length < 2}
              onClick={() => setSheet({ type: "movement", kind: "transfer" })}
            >
              <ArrowLeftRight className="h-4 w-4" />
              Transfer
            </Button>
            <Button
              variant="outline"
              disabled={!hasAccounts}
              onClick={() =>
                setSheet({ type: "movement", kind: "owner-withdrawal" })
              }
            >
              <LogOut className="h-4 w-4" />
              Owner withdrawal
            </Button>
            <Button onClick={() => setSheet({ type: "account" })}>
              <Plus className="h-4 w-4" />
              Add account
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStatCard
          label="Total funds"
          value={formatCurrency(totals.total)}
          description={`${activeAccounts.length} active account${activeAccounts.length === 1 ? "" : "s"}`}
          icon={Wallet}
          index={0}
        />
        <SimpleStatCard
          label="Cash in hand"
          value={formatCurrency(totals.CASH)}
          icon={Banknote}
          index={1}
        />
        <SimpleStatCard
          label="Bank"
          value={formatCurrency(totals.BANK)}
          icon={Landmark}
          index={2}
        />
        <SimpleStatCard
          label="UPI"
          value={formatCurrency(totals.UPI)}
          icon={Smartphone}
          index={3}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <h3 className="text-sm font-semibold">Accounts</h3>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No accounts yet"
              description="Add a cash, bank, or UPI account to start tracking funds."
              action={
                <Button onClick={() => setSheet({ type: "account" })}>
                  <Plus className="h-4 w-4" />
                  Add account
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accounts.map((account) => (
                    <TableRow
                      key={account._id}
                      className="cursor-pointer"
                      data-state={
                        account._id === effectiveSelectedId
                          ? "selected"
                          : undefined
                      }
                      onClick={() => selectAccount(account._id)}
                    >
                      <TableCell>
                        <p className="font-medium">{account.name}</p>
                        {account.isDefault ? (
                          <p className="text-xs text-muted-foreground">
                            Default account
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {ACCOUNT_TYPE_LABELS[account.accountType]}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(account.openingBalance)}
                      </TableCell>
                      <TableCell
                        className={
                          account.currentBalance < 0
                            ? "text-right font-medium text-destructive"
                            : "text-right font-medium"
                        }
                      >
                        {formatCurrency(account.currentBalance)}
                      </TableCell>
                      <TableCell>
                        {account.isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => selectAccount(account._id)}
                            >
                              <BookOpen className="h-4 w-4" />
                              View ledger
                            </DropdownMenuItem>
                            {account.isActive ? (
                              <>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setSheet({
                                      type: "movement",
                                      kind: "deposit",
                                      accountId: account._id,
                                    })
                                  }
                                >
                                  <ArrowDownLeft className="h-4 w-4" />
                                  Deposit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setSheet({
                                      type: "movement",
                                      kind: "withdraw",
                                      accountId: account._id,
                                    })
                                  }
                                >
                                  <ArrowUpRight className="h-4 w-4" />
                                  Withdraw
                                </DropdownMenuItem>
                              </>
                            ) : null}
                            <DropdownMenuItem
                              onClick={() => void toggleAccountActive(account)}
                            >
                              {account.isActive ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedAccount ? (
        <Card>
          <CardContent className="space-y-4 p-4 sm:p-6">
            <div>
              <h3 className="text-sm font-semibold">
                Ledger · {selectedAccount.name}
              </h3>
              <p className="text-xs text-muted-foreground">
                In increases the balance; Out decreases it.
              </p>
            </div>

            {ledgerLoading && !ledger ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">In</TableHead>
                        <TableHead className="text-right">Out</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(ledger?.data ?? []).map((entry) => (
                        <TableRow key={entry._id}>
                          <TableCell>{formatDate(entry.entryDate)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {ENTRY_TYPE_LABELS[entry.entryType] ??
                                entry.entryType}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {entry.transactionNumber}
                          </TableCell>
                          <TableCell>{entry.description || "—"}</TableCell>
                          <TableCell className="text-right">
                            {entry.debit > 0 ? formatCurrency(entry.debit) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {entry.credit > 0
                              ? formatCurrency(entry.credit)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {entry.runningBalance === undefined
                              ? "—"
                              : formatCurrency(entry.runningBalance)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!ledger?.data?.length ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="py-8 text-center text-muted-foreground"
                          >
                            No ledger entries yet.
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
                {ledger ? (
                  <PaginationControls
                    page={ledger.pagination.page}
                    totalPages={ledger.pagination.totalPages}
                    total={ledger.pagination.total}
                    onPageChange={setLedgerPage}
                  />
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Sheet
        open={Boolean(sheet)}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle>{copy?.title ?? "Add account"}</SheetTitle>
            <SheetDescription>
              {copy?.description ??
                "Create a cash, bank, or UPI account to hold funds."}
            </SheetDescription>
          </SheetHeader>
          {sheet?.type === "movement" ? (
            <MovementForm
              key={`${sheet.kind}:${sheet.accountId ?? ""}`}
              kind={sheet.kind}
              accounts={activeAccounts}
              initialAccountId={sheet.accountId ?? effectiveSelectedId}
              onCancel={() => setSheet(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {sheet?.type === "account" ? (
            <AccountForm
              onCancel={() => setSheet(null)}
              onSaved={handleSaved}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
