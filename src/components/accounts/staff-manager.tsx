"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useEffectEvent, useState } from "react";
import {
  CalendarPlus,
  HandCoins,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  AccountSelect,
  FormField,
  METHOD_LABELS,
  currentPeriod,
  defaultAccountFor,
  errorMessage,
  formatDate,
  formatPeriod,
  newIdempotencyKey,
  parseAmount,
  todayInput,
  useAccountOptions,
} from "@/components/accounts/accounts-shared";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyState } from "@/components/shared/empty-state";
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
  SALARY_PAYMENT_METHODS,
  type SalaryPaymentMethod,
} from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type {
  FinancialAccountRecord,
  SalaryRecordRow,
  StaffListResponse,
  StaffRecord,
  StaffStats,
} from "@/types/accounts";

type PaymentKind = "REGULAR" | "ADVANCE" | "BONUS";

const KIND_LABELS: Record<PaymentKind, string> = {
  REGULAR: "Salary",
  ADVANCE: "Advance",
  BONUS: "Bonus",
};

const SALARY_STATUS_BADGE: Record<
  string,
  { label: string; variant: "success" | "warning" | "secondary" }
> = {
  PAID: { label: "Paid", variant: "success" },
  PARTIAL: { label: "Partial", variant: "warning" },
  UNPAID: { label: "Unpaid", variant: "secondary" },
};

type SheetState =
  | { type: "staff"; staff: StaffRecord | null }
  | { type: "record"; staff: StaffRecord | null }
  | { type: "pay"; staff: StaffRecord; kind: PaymentKind };

/* -------------------------------- Staff form ------------------------------- */

function StaffForm({
  staff,
  onSaved,
  onCancel,
}: {
  staff: StaffRecord | null;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [designation, setDesignation] = useState(staff?.designation ?? "");
  const [joiningDate, setJoiningDate] = useState(
    staff ? staff.joiningDate.slice(0, 10) : todayInput(),
  );
  const [monthlySalary, setMonthlySalary] = useState(
    staff ? String(staff.monthlySalary) : "",
  );
  const [preference, setPreference] = useState<SalaryPaymentMethod>(
    staff?.paymentPreference ?? "CASH",
  );
  const [notes, setNotes] = useState(staff?.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return toast.error("Enter the staff member's name.");
    if (parseAmount(monthlySalary) < 0 || monthlySalary === "") {
      return toast.error("Enter a monthly salary.");
    }

    setSaving(true);
    try {
      await fetchJson(
        staff ? `/api/accounts/staff/${staff._id}` : "/api/accounts/staff",
        {
          method: staff ? "PATCH" : "POST",
          body: JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            designation: designation.trim(),
            joiningDate,
            monthlySalary: parseAmount(monthlySalary),
            paymentPreference: preference,
            notes: notes.trim(),
          }),
        },
      );
      toast.success(staff ? "Staff updated" : "Staff added");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not save staff member."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField label="Name" htmlFor="staff-name">
        <Input
          id="staff-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Phone" htmlFor="staff-phone">
          <Input
            id="staff-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </FormField>
        <FormField label="Designation" htmlFor="staff-designation">
          <Input
            id="staff-designation"
            placeholder="e.g. Cashier"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
          />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Monthly salary" htmlFor="staff-salary">
          <Input
            id="staff-salary"
            type="number"
            min={0}
            step="0.01"
            value={monthlySalary}
            onChange={(e) => setMonthlySalary(e.target.value)}
          />
        </FormField>
        <FormField label="Joining date" htmlFor="staff-joined">
          <Input
            id="staff-joined"
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
          />
        </FormField>
      </div>
      <FormField label="Preferred payment method">
        <Select
          value={preference}
          onValueChange={(value) => setPreference(value as SalaryPaymentMethod)}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SALARY_PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {METHOD_LABELS[method] ?? method}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Notes" htmlFor="staff-notes">
        <Textarea
          id="staff-notes"
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
          ) : staff ? (
            "Save changes"
          ) : (
            "Add staff"
          )}
        </Button>
      </div>
    </form>
  );
}

/* ---------------------------- Salary period form --------------------------- */

function SalaryRecordForm({
  staffList,
  initialStaffId,
  initialPeriod,
  onSaved,
  onCancel,
}: {
  staffList: StaffRecord[];
  initialStaffId: string;
  initialPeriod: string;
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [staffId, setStaffId] = useState(initialStaffId);
  const [period, setPeriod] = useState(initialPeriod);
  const [bonus, setBonus] = useState("");
  const [deductions, setDeductions] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const selected = staffList.find((member) => member._id === staffId);
  const preview = selected
    ? Math.max(
        0,
        selected.monthlySalary + parseAmount(bonus) - parseAmount(deductions),
      )
    : 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!staffId) return toast.error("Select a staff member.");
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return toast.error("Select a salary month.");
    }

    setSaving(true);
    try {
      await fetchJson("/api/accounts/staff/salary-records", {
        method: "POST",
        body: JSON.stringify({
          staffId,
          period,
          bonus: parseAmount(bonus),
          deductions: parseAmount(deductions),
          notes: notes.trim(),
        }),
      });
      toast.success("Salary period created");
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not create salary period."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField label="Staff member">
        <Select value={staffId} onValueChange={setStaffId}>
          <SelectTrigger className="rounded-xl">
            <SelectValue placeholder="Select staff" />
          </SelectTrigger>
          <SelectContent>
            {staffList
              .filter((member) => member.isActive)
              .map((member) => (
                <SelectItem key={member._id} value={member._id}>
                  {member.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Salary month" htmlFor="rec-period">
        <Input
          id="rec-period"
          type="month"
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Bonus" htmlFor="rec-bonus">
          <Input
            id="rec-bonus"
            type="number"
            min={0}
            step="0.01"
            value={bonus}
            onChange={(e) => setBonus(e.target.value)}
          />
        </FormField>
        <FormField label="Deductions" htmlFor="rec-deductions">
          <Input
            id="rec-deductions"
            type="number"
            min={0}
            step="0.01"
            value={deductions}
            onChange={(e) => setDeductions(e.target.value)}
          />
        </FormField>
      </div>
      {selected ? (
        <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Salary before advance</span>
            <span className="font-medium">{formatCurrency(preview)}</span>
          </div>
          {selected.advanceBalance ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Any outstanding advance (
              {formatCurrency(selected.advanceBalance)}) is adjusted
              automatically.
            </p>
          ) : null}
        </div>
      ) : null}
      <FormField label="Notes" htmlFor="rec-notes">
        <Textarea
          id="rec-notes"
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
            "Create salary period"
          )}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------- Payment form ------------------------------ */

function SalaryPaymentForm({
  staff,
  initialKind,
  records,
  accounts,
  onSaved,
  onCancel,
}: {
  staff: StaffRecord;
  initialKind: PaymentKind;
  records: SalaryRecordRow[];
  accounts: FinancialAccountRecord[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
}) {
  const [idempotencyKey] = useState(newIdempotencyKey);
  const dueRecords = records.filter(
    (record) => record.staffId === staff._id && record.balanceDue > 0,
  );
  const [kind, setKind] = useState<PaymentKind>(initialKind);
  const [recordId, setRecordId] = useState(dueRecords[0]?._id ?? "");
  const [amount, setAmount] = useState(
    initialKind === "REGULAR" && dueRecords[0]
      ? String(dueRecords[0].balanceDue)
      : "",
  );
  const [method, setMethod] = useState<SalaryPaymentMethod>(
    staff.paymentPreference,
  );
  const [selectedAccountId, setAccountId] = useState("");
  const accountId =
    selectedAccountId || defaultAccountFor(accounts, method);
  const [paymentDate, setPaymentDate] = useState(todayInput);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  function changeRecord(id: string) {
    setRecordId(id);
    const record = dueRecords.find((row) => row._id === id);
    if (record) setAmount(String(record.balanceDue));
  }

  function changeKind(next: PaymentKind) {
    setKind(next);
    if (next === "REGULAR" && dueRecords[0]) {
      setRecordId(dueRecords[0]._id);
      setAmount(String(dueRecords[0].balanceDue));
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    if (value <= 0) return toast.error("Enter an amount greater than 0.");
    if (kind === "REGULAR" && !recordId) {
      return toast.error("Select a salary period to pay.");
    }
    if (!accountId) return toast.error("Select an account to pay from.");

    setSaving(true);
    try {
      await fetchJson("/api/accounts/staff/salary-payments", {
        method: "POST",
        body: JSON.stringify({
          staffId: staff._id,
          salaryRecordId: kind === "REGULAR" ? recordId : null,
          paymentKind: kind,
          amount: value,
          paymentMethod: method,
          accountId,
          paymentDate,
          notes: notes.trim(),
          idempotencyKey,
        }),
      });
      toast.success(`${KIND_LABELS[kind]} payment recorded`);
      await onSaved();
    } catch (error) {
      toast.error(errorMessage(error, "Could not record payment."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-5 p-4 sm:p-6" onSubmit={handleSubmit}>
      <FormField label="Payment type">
        <Select
          value={kind}
          onValueChange={(value) => changeKind(value as PaymentKind)}
        >
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(KIND_LABELS) as PaymentKind[]).map((value) => (
              <SelectItem key={value} value={value}>
                {KIND_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {kind === "REGULAR" ? (
        <FormField
          label="Salary period"
          hint={
            dueRecords.length === 0
              ? "No unpaid salary periods. Create a salary period first."
              : undefined
          }
        >
          <Select
            value={recordId}
            onValueChange={changeRecord}
            disabled={dueRecords.length === 0}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {dueRecords.map((record) => (
                <SelectItem key={record._id} value={record._id}>
                  {formatPeriod(record.period)} · due{" "}
                  {formatCurrency(record.balanceDue)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
      ) : kind === "ADVANCE" ? (
        <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
          Advances are recovered automatically from the next salary period.
        </p>
      ) : null}

      <FormField label="Amount" htmlFor="sal-amount">
        <Input
          id="sal-amount"
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
              setMethod(value as SalaryPaymentMethod);
              setAccountId("");
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SALARY_PAYMENT_METHODS.map((value) => (
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

      <FormField label="Payment date" htmlFor="sal-date">
        <Input
          id="sal-date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />
      </FormField>
      <FormField label="Notes" htmlFor="sal-notes">
        <Textarea
          id="sal-notes"
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

export function StaffManager() {
  const { accounts } = useAccountOptions();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(currentPeriod);
  const [staff, setStaff] = useState<StaffRecord[]>([]);
  const [records, setRecords] = useState<SalaryRecordRow[]>([]);
  const [stats, setStats] = useState<StaffStats | null>(null);
  const [sheet, setSheet] = useState<SheetState | null>(null);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchJson<StaffListResponse>(
        `/api/accounts/staff?period=${encodeURIComponent(period)}`,
        { cache: "no-store" },
      );
      setStaff(response.data);
      setRecords(response.salaryRecords ?? []);
      setStats(response.stats ?? null);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to load staff."));
    } finally {
      setLoading(false);
    }
  }, [period]);

  const onLoad = useEffectEvent(() => {
    void loadStaff();
  });

  useEffect(() => {
    onLoad();
  }, [period]);

  async function toggleActive(member: StaffRecord) {
    try {
      await fetchJson(`/api/accounts/staff/${member._id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !member.isActive }),
      });
      toast.success(member.isActive ? "Staff deactivated" : "Staff activated");
      await loadStaff();
    } catch (error) {
      toast.error(errorMessage(error, "Could not update staff member."));
    }
  }

  async function handleSaved() {
    setSheet(null);
    await loadStaff();
  }

  const periodRecords = records.filter((record) => record.period === period);
  const activeStaff = staff.filter((member) => member.isActive);
  const commitment =
    stats?.monthlyCommitment ??
    activeStaff.reduce((sum, member) => sum + member.monthlySalary, 0);
  const paid =
    stats?.salaryPaidThisPeriod ??
    periodRecords.reduce((sum, record) => sum + record.amountPaid, 0);
  const pending =
    stats?.salaryPendingThisPeriod ??
    periodRecords.reduce((sum, record) => sum + record.balanceDue, 0);

  const sheetTitle =
    sheet?.type === "staff"
      ? sheet.staff
        ? "Edit staff"
        : "Add staff"
      : sheet?.type === "record"
        ? "Create salary period"
        : "Pay staff";
  const sheetDescription =
    sheet?.type === "staff"
      ? "Staff details and monthly salary."
      : sheet?.type === "record"
        ? "Recognise the month's salary. Advances are adjusted automatically."
        : sheet?.type === "pay"
          ? `Payment to ${sheet.staff.name}.`
          : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff & Salaries"
        description="Staff directory, monthly salary periods, advances, and payments."
        actions={
          <>
            <Input
              type="month"
              aria-label="Salary month"
              className="w-[170px]"
              value={period}
              onChange={(e) => e.target.value && setPeriod(e.target.value)}
            />
            <Button
              variant="outline"
              onClick={() => setSheet({ type: "record", staff: null })}
              disabled={activeStaff.length === 0}
            >
              <CalendarPlus className="h-4 w-4" />
              Salary period
            </Button>
            <Button onClick={() => setSheet({ type: "staff", staff: null })}>
              <Plus className="h-4 w-4" />
              Add staff
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SimpleStatCard
          label="Active staff"
          value={formatNumber(stats?.activeStaff ?? activeStaff.length)}
          icon={Users}
          index={0}
        />
        <SimpleStatCard
          label="Monthly commitment"
          value={formatCurrency(commitment)}
          description="Sum of active salaries"
          icon={Wallet}
          index={1}
        />
        <SimpleStatCard
          label="Paid"
          value={formatCurrency(paid)}
          description={formatPeriod(period)}
          icon={HandCoins}
          index={2}
        />
        <SimpleStatCard
          label="Pending"
          value={formatCurrency(pending)}
          description={formatPeriod(period)}
          icon={CalendarPlus}
          index={3}
        />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-xl" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="No staff yet"
              description="Add your team to track salaries, advances, and payroll expense."
              action={
                <Button onClick={() => setSheet({ type: "staff", staff: null })}>
                  <Plus className="h-4 w-4" />
                  Add staff
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Monthly salary</TableHead>
                    <TableHead className="text-right">Advance</TableHead>
                    <TableHead>{formatPeriod(period)}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => {
                    const record = periodRecords.find(
                      (row) => row.staffId === member._id,
                    );
                    const badge = record
                      ? SALARY_STATUS_BADGE[record.status]
                      : null;
                    return (
                      <TableRow key={member._id}>
                        <TableCell>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {[member.designation, member.phone]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </TableCell>
                        <TableCell>{formatDate(member.joiningDate)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(member.monthlySalary)}
                        </TableCell>
                        <TableCell className="text-right">
                          {member.advanceBalance
                            ? formatCurrency(member.advanceBalance)
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {record && badge ? (
                            <div className="space-y-1">
                              <Badge variant={badge.variant}>{badge.label}</Badge>
                              {record.balanceDue > 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  Due {formatCurrency(record.balanceDue)}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Not created
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {member.isActive ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() =>
                                  setSheet({ type: "staff", staff: member })
                                }
                              >
                                <Pencil className="h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {member.isActive ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setSheet({ type: "record", staff: member })
                                    }
                                  >
                                    <CalendarPlus className="h-4 w-4" />
                                    Create salary period
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setSheet({
                                        type: "pay",
                                        staff: member,
                                        kind: "REGULAR",
                                      })
                                    }
                                  >
                                    <HandCoins className="h-4 w-4" />
                                    Pay salary
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setSheet({
                                        type: "pay",
                                        staff: member,
                                        kind: "ADVANCE",
                                      })
                                    }
                                  >
                                    <Wallet className="h-4 w-4" />
                                    Pay advance
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              <DropdownMenuItem
                                onClick={() => void toggleActive(member)}
                              >
                                {member.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(sheet)}
        onOpenChange={(open) => {
          if (!open) setSheet(null);
        }}
      >
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b border-border pb-4">
            <SheetTitle>{sheetTitle}</SheetTitle>
            <SheetDescription>{sheetDescription}</SheetDescription>
          </SheetHeader>
          {sheet?.type === "staff" ? (
            <StaffForm
              staff={sheet.staff}
              onCancel={() => setSheet(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {sheet?.type === "record" ? (
            <SalaryRecordForm
              staffList={staff}
              initialStaffId={sheet.staff?._id ?? ""}
              initialPeriod={period}
              onCancel={() => setSheet(null)}
              onSaved={handleSaved}
            />
          ) : null}
          {sheet?.type === "pay" ? (
            <SalaryPaymentForm
              key={`${sheet.staff._id}:${sheet.kind}`}
              staff={sheet.staff}
              initialKind={sheet.kind}
              records={records}
              accounts={accounts}
              onCancel={() => setSheet(null)}
              onSaved={handleSaved}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
