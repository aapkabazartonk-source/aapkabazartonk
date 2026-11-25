"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import {
  Banknote,
  CircleDollarSign,
  Clock,
  Loader2,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AccountSelect,
  FormField,
  METHOD_LABELS,
  defaultAccountFor,
  errorMessage,
  formatDate,
  newIdempotencyKey,
  parseAmount,
  todayInput,
  useAccountOptions,
} from "@/components/accounts/accounts-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
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
  EXPENSE_PAYMENT_METHODS,
  type ExpensePaymentMethod,
} from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  ExpenseCategoryRecord,
  ExpenseListResponse,
  ExpenseRecord,
  ExpenseStats,
  FinancialAccountRecord,
} from "@/types/accounts";

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  PAID: { label: "Paid", variant: "success" },
  PARTIAL: { label: "Partial", variant: "warning" },
  PENDING: { label: "Pending", variant: "secondary" },
};

/* ------------------------------ Create expense ----------------------------- */

interface ExpenseFormProps {
  categories: ExpenseCategoryRecord[];
  accounts: FinancialAccountRecord[];
  onCategoryCreated: (name: string) => Promise<string | null>;
  onCategoryToggle: (category: ExpenseCategoryRecord) => Promise<void>;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}

function ExpenseForm({
  categories,
  accounts,
  onCategoryCreated,
  onCategoryToggle,
  onSaved,
  onCancel,
}: ExpenseFormProps) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayInput);
  const [notes, setNotes] = useState("");
  const [payNow, setPayNow] = useState(true);
  const [paidAmount, setPaidAmount] = useState("");
  const [method, setMethod] = useState<ExpensePaymentMethod>("CASH");
  const [selectedAccountId, setAccountId] = useState("");
  const accountId =
    selectedAccountId || defaultAccountFor(accounts, method);
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [saving, setSaving] = useState(false);

  async function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    setAddingCategory(true);
    const createdId = await onCategoryCreated(name);
    setAddingCategory(false);
    if (createdId) {
      setCategoryId(createdId);
      setNewCategory("");
    }
  }

  function changeMethod(next: ExpensePaymentMethod) {
    setMethod(next);
    setAccountId("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const total = parseAmount(amount);
    if (!title.trim()) return toast.error("Enter an expense title.");
    if (!categoryId) return toast.error("Select a category.");
    if (total <= 0) return toast.error("Enter an amount greater than 0.");

    const paid = payNow ? parseAmount(paidAmount) || total : 0;
    if (paid > total) {
      return toast.error("Paid amount cannot exceed the expense amount.");
    }
    if (paid > 0 && !accountId) {
      return toast.error("Select an account to pay from.");
    }

    setSaving(true);
    try {
      await fetchJson("/api/accounts/expenses", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          categoryId,
          amount: total,
          expenseDate,
          notes: notes.trim(),
          ...(paid > 0
            ? {
                payNowAmount: paid,
                paymentMethod: method,
                accountId,
                paymentDate: expenseDate,
              }
            : {}),
          idempotencyKey,
        }),
      });
      toast.success(paid > 0 ? "Expense recorded and paid" : "Expense recorded");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save expense."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField label="Title" htmlFor="exp-title">
        <Input
          id="exp-title"
          placeholder="e.g. Shop rent for November"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </FormField>

      <FormField label="Category">
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {categories
              .filter((category) => category.isActive)
              .map((category) => (
                <SelectItem key={category._id} value={category._id}>
                  {category.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="Add a new category"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            disabled={addingCategory || !newCategory.trim()}
            onClick={() => void addCategory()}
          >
            {addingCategory ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Add"
            )}
          </Button>
        </div>
        {categories.some((category) => !category.isSystem) ? (
          <div className="space-y-2 rounded-xl border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Custom categories
            </p>
            {categories
              .filter((category) => !category.isSystem)
              .map((category) => (
                <div
                  key={category._id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className={!category.isActive ? "text-muted-foreground line-through" : ""}>
                    {category.name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => void onCategoryToggle(category)}
                  >
                    {category.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              ))}
          </div>
        ) : null}
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" htmlFor="exp-amount">
          <Input
            id="exp-amount"
            type="number"
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </FormField>
        <FormField label="Expense date" htmlFor="exp-date">
          <Input
            id="exp-date"
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
          />
        </FormField>
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={payNow}
            onChange={(e) => setPayNow(e.target.checked)}
          />
          Pay now
        </label>
        {payNow ? (
          <div className="space-y-4">
            <FormField
              label="Amount paid"
              htmlFor="exp-paid"
              hint="Leave blank to pay the full amount."
            >
              <Input
                id="exp-paid"
                type="number"
                min={0.01}
                step="0.01"
                placeholder={amount || "0"}
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Payment method">
                <Select
                  value={method}
                  onValueChange={(value) =>
                    changeMethod(value as ExpensePaymentMethod)
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_PAYMENT_METHODS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {METHOD_LABELS[value] ?? value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="Pay from">
                <AccountSelect
                  accounts={accounts}
                  value={accountId}
                  onValueChange={setAccountId}
                />
              </FormField>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            The expense will be saved as pending and can be paid later.
          </p>
        )}
      </div>

      <FormField label="Notes" htmlFor="exp-notes">
        <Textarea
          id="exp-notes"
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
            "Save expense"
          )}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------- Pay expense ------------------------------- */

function ExpensePayForm({
  expense,
  accounts,
  onSaved,
  onCancel,
}: {
  expense: ExpenseRecord;
  accounts: FinancialAccountRecord[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const [amount, setAmount] = useState(String(expense.balanceDue));
  const [method, setMethod] = useState<ExpensePaymentMethod>("CASH");
  const [selectedAccountId, setAccountId] = useState("");
  const accountId =
    selectedAccountId || defaultAccountFor(accounts, method);
  const [paymentDate, setPaymentDate] = useState(todayInput);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value <= 0) return toast.error("Enter an amount greater than 0.");
    if (value > expense.balanceDue + 0.001) {
      return toast.error("Payment exceeds the outstanding balance.");
    }
    if (!accountId) return toast.error("Select an account to pay from.");

    setSaving(true);
    try {
      await fetchJson(`/api/accounts/expenses/${expense._id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: value,
          paymentMethod: method,
          accountId,
          paymentDate,
          notes: notes.trim(),
          idempotencyKey,
        }),
      });
      toast.success("Payment recorded");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not record payment."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField label="Amount" htmlFor="pay-amount">
        <Input
          id="pay-amount"
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Payment method">
          <Select
            value={method}
            onValueChange={(value) => {
              setMethod(value as ExpensePaymentMethod);
              setAccountId("");
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXPENSE_PAYMENT_METHODS.map((value) => (
                <SelectItem key={value} value={value}>
                  {METHOD_LABELS[value] ?? value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField label="Pay from">
          <AccountSelect
            accounts={accounts}
            value={accountId}
            onValueChange={setAccountId}
          />
        </FormField>
      </div>
      <FormField label="Payment date" htmlFor="pay-date">
        <Input
          id="pay-date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </FormField>
      <FormField label="Notes" htmlFor="pay-notes">
        <Textarea
          id="pay-notes"
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
            "Record payment"
          )}
        </Button>
      </div>
    </form>
  );
}

/* --------------------------------- Manager --------------------------------- */

export function ExpensesManager() {
  const { accounts } = useAccountOptions();
  const [loading, setLoading] = useState(true);
  const [reversing, setReversing] = useState(false);
  const [items, setItems] = useState<ExpenseRecord[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [categories, setCategories] = useState<ExpenseCategoryRecord[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<ExpenseRecord | null>(null);
  const [reverseTarget, setReverseTarget] = useState<ExpenseRecord | null>(
    null,
  );

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, categoryFilter, statusFilter, from, to]);

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
      });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (categoryFilter !== "all") params.set("categoryId", categoryFilter);
      if (statusFilter !== "all") params.set("paymentStatus", statusFilter);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetchJson<ExpenseListResponse>(
        `/api/accounts/expenses?${params.toString()}`,
        { cache: "no-store" },
      );
      setItems(response.data);
      setPagination(response.pagination);
      setStats(response.stats ?? null);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load expenses."));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, categoryFilter, statusFilter, from, to]);

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetchJson<{ data: ExpenseCategoryRecord[] }>(
        "/api/accounts/expense-categories",
        { cache: "no-store" },
      );
      setCategories(response.data);
      return response.data;
    } catch (error) {
      toast.error(errorMessage(error, "Could not load categories."));
      return [];
    }
  }, []);

  const onLoad = useEffectEvent(() => {
    void loadExpenses();
  });

  useEffect(() => {
    onLoad();
  }, [page, debouncedSearch, categoryFilter, statusFilter, from, to]);

  const onLoadCategories = useEffectEvent(() => {
    void loadCategories();
  });

  useEffect(() => {
    onLoadCategories();
  }, []);

  async function handleCategoryCreated(name: string) {
    try {
      await fetchJson("/api/accounts/expense-categories", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      toast.success("Category added");
      const next = await loadCategories();
      return (
        next.find(
          (category) => category.name.toLowerCase() === name.toLowerCase(),
        )?._id ?? null
      );
    } catch (error) {
      toast.error(errorMessage(error, "Could not add category."));
      return null;
    }
  }

  async function toggleCategoryActive(category: ExpenseCategoryRecord) {
    try {
      await fetchJson(`/api/accounts/expense-categories/${category._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !category.isActive }),
      });
      toast.success(
        category.isActive ? "Category deactivated" : "Category activated",
      );
      await loadCategories();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update category."));
    }
  }

  async function handleReverse() {
    if (!reverseTarget) return;
    setReversing(true);
    try {
      await fetchJson(`/api/accounts/expenses/${reverseTarget._id}`, {
        method: "DELETE",
      });
      toast.success("Expense reversed");
      setReverseTarget(null);
      await loadExpenses();
    } catch (error) {
      toast.error(errorMessage(error, "Could not reverse expense."));
    } finally {
      setReversing(false);
    }
  }

  const pageTotal = items
    .filter((item) => !item.isReversed)
    .reduce((sum, item) => sum + item.amount, 0);
  const pageDue = items
    .filter((item) => !item.isReversed)
    .reduce((sum, item) => sum + item.balanceDue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Record operating expenses, settle pending bills, and reverse mistakes."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Add expense
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStatCard
          label="Expenses"
          value={formatNumber(stats?.count ?? pagination.total)}
          description="Matching current filters"
          icon={Receipt}
          index={0}
        />
        <SimpleStatCard
          label="Total amount"
          value={formatCurrency(stats?.totalExpenses ?? pageTotal)}
          description={stats?.totalExpenses === undefined ? "On this page" : undefined}
          icon={CircleDollarSign}
          index={1}
        />
        <SimpleStatCard
          label="Paid"
          value={formatCurrency(
            stats?.paidExpenses ?? Math.max(0, pageTotal - pageDue),
          )}
          description={stats?.paidExpenses === undefined ? "On this page" : undefined}
          icon={Banknote}
          index={2}
        />
        <SimpleStatCard
          label="Pending"
          value={formatCurrency(stats?.pendingExpenses ?? pageDue)}
          description={stats?.pendingExpenses === undefined ? "On this page" : undefined}
          icon={Clock}
          index={3}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_11rem_10rem_10rem_10rem]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search title or number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category._id} value={category._id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              aria-label="From date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <Input
              type="date"
              aria-label="To date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expenses found"
              description="Record rent, utilities, and other running costs to see true profit."
              action={
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add expense
                </Button>
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expense</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((expense) => {
                      const badge = STATUS_BADGE[expense.paymentStatus];
                      const canPay =
                        !expense.isReversed && expense.balanceDue > 0;
                      return (
                        <TableRow
                          key={expense._id}
                          className={expense.isReversed ? "opacity-60" : undefined}
                        >
                          <TableCell>
                            <p className="font-medium">{expense.title}</p>
                            <p className="font-mono text-xs text-muted-foreground">
                              {expense.expenseNumber}
                            </p>
                          </TableCell>
                          <TableCell>{expense.categoryName}</TableCell>
                          <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(expense.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(expense.amountPaid)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(expense.balanceDue)}
                          </TableCell>
                          <TableCell>
                            {expense.isReversed ? (
                              <Badge variant="destructive">Reversed</Badge>
                            ) : (
                              <Badge variant={badge?.variant ?? "secondary"}>
                                {badge?.label ?? expense.paymentStatus}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {expense.isReversed ? null : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {canPay ? (
                                    <DropdownMenuItem
                                      onClick={() => setPayTarget(expense)}
                                    >
                                      <Banknote className="h-4 w-4" />
                                      Pay balance
                                    </DropdownMenuItem>
                                  ) : null}
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => setReverseTarget(expense)}
                                  >
                                    <Undo2 className="h-4 w-4" />
                                    Reverse
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <PaginationControls
                page={pagination.page}
                totalPages={pagination.totalPages}
                total={pagination.total}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={createOpen} onOpenChange={setCreateOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle>Add expense</SheetTitle>
            <SheetDescription>
              Record a cost and optionally pay it from a cash, bank, or UPI
              account.
            </SheetDescription>
          </SheetHeader>
          <ExpenseForm
            categories={categories}
            accounts={accounts}
            onCategoryCreated={handleCategoryCreated}
            onCategoryToggle={toggleCategoryActive}
            onCancel={() => setCreateOpen(false)}
            onSaved={async () => {
              setCreateOpen(false);
              await loadExpenses();
            }}
          />
        </SheetContent>
      </Sheet>

      <Sheet
        open={Boolean(payTarget)}
        onOpenChange={(open) => {
          if (!open) setPayTarget(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle>Pay expense</SheetTitle>
            <SheetDescription>
              {payTarget
                ? `${payTarget.title} · outstanding ${formatCurrency(payTarget.balanceDue)}`
                : ""}
            </SheetDescription>
          </SheetHeader>
          {payTarget ? (
            <ExpensePayForm
              key={payTarget._id}
              expense={payTarget}
              accounts={accounts}
              onCancel={() => setPayTarget(null)}
              onSaved={async () => {
                setPayTarget(null);
                await loadExpenses();
              }}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <ConfirmDeleteDialog
        open={Boolean(reverseTarget)}
        onOpenChange={(open) => {
          if (!open) setReverseTarget(null);
        }}
        title="Reverse expense?"
        description={
          reverseTarget
            ? `Reverse "${reverseTarget.title}"? Any payments made will be returned to their accounts and the expense will no longer count towards profit.`
            : ""
        }
        confirmLabel="Reverse"
        confirmingLabel="Reversing…"
        confirming={reversing}
        onConfirm={handleReverse}
      />
    </div>
  );
}
