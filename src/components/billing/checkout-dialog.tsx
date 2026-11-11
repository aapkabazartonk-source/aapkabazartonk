"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/utils";
import {
  paymentRecordLabel,
  type SaleQuote,
  type TenderMethod,
} from "@/types/billing";

export type TenderDraft = {
  id: string;
  method: TenderMethod;
  amount: string;
  reference: string;
};

export function draftsToPayments(drafts: TenderDraft[]) {
  return drafts.flatMap((draft) => {
    const amount = Number(draft.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    return [
      {
        method: draft.method,
        amount,
        ...(draft.method === "CASH" ? { tenderedAmount: amount } : {}),
        referenceNumber: draft.reference.trim(),
      },
    ];
  });
}

const ALL_METHODS: { value: TenderMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "BANK_TRANSFER", label: "Bank transfer" },
];

export function CheckoutDialog({
  open,
  onOpenChange,
  quote,
  quoting,
  quoteError,
  payments,
  onPaymentsChange,
  allowCredit,
  onAllowCreditChange,
  submitting,
  onConfirm,
  enabledPaymentMethods,
  allowCreditSales = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: SaleQuote | null;
  quoting: boolean;
  quoteError: string;
  payments: TenderDraft[];
  onPaymentsChange: (payments: TenderDraft[]) => void;
  allowCredit: boolean;
  onAllowCreditChange: (value: boolean) => void;
  submitting: boolean;
  onConfirm: () => void;
  enabledPaymentMethods?: TenderMethod[];
  allowCreditSales?: boolean;
}) {
  const METHODS = ALL_METHODS.filter((method) =>
    (enabledPaymentMethods?.length
      ? enabledPaymentMethods
      : ALL_METHODS.map((row) => row.value)
    ).includes(method.value),
  );
  const settlement = quote?.settlement;
  const grand = quote?.totals.grandTotal ?? 0;

  const update = (id: string, patch: Partial<TenderDraft>) => {
    onPaymentsChange(
      payments.map((payment) => (payment.id === id ? { ...payment, ...patch } : payment)),
    );
  };

  const fillExact = (id: string) => {
    const others = payments.reduce((sum, payment) => {
      if (payment.id === id) return sum;
      const amount = Number(payment.amount);
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const remaining = Math.max(0, Math.round((grand - others) * 100) / 100);
    update(id, { amount: remaining ? String(remaining) : "" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Totals are calculated on the server. UPI, card, and bank transfer are recorded as
            manually confirmed. No payment gateway is connected.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl bg-purple-soft px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-purple">Total payable</p>
          <p className="text-2xl font-semibold text-foreground">{formatCurrency(grand)}</p>
          {quote?.invoiceType ? (
            <p className="text-xs text-muted-foreground">
              {quote.invoiceType === "TAX_INVOICE" ? "Tax invoice" : "Bill of supply"}
              {quote.supplyType === "INTER" ? " · IGST" : quote.totals.totalTax > 0 ? " · CGST + SGST" : ""}
            </p>
          ) : null}
        </div>

        <div className="space-y-3">
          {payments.map((payment, index) => (
            <div key={payment.id} className="rounded-2xl border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <Label>Method</Label>
                  <Select
                    value={payment.method}
                    onValueChange={(value) => update(payment.id, { method: value as TenderMethod })}
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {METHODS.map((method) => (
                        <SelectItem key={method.value} value={method.value}>
                          {method.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{payment.method === "CASH" ? "Cash received" : "Amount"}</Label>
                  <Input
                    inputMode="decimal"
                    className="h-11"
                    value={payment.amount}
                    onChange={(event) => update(payment.id, { amount: event.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex items-end gap-2">
                  {payment.method === "CASH" ? (
                    <Button type="button" variant="outline" className="h-11" onClick={() => fillExact(payment.id)}>
                      Exact
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    disabled={payments.length === 1}
                    onClick={() => onPaymentsChange(payments.filter((row) => row.id !== payment.id))}
                    aria-label={`Remove payment ${index + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {payment.method !== "CASH" ? (
                <div className="mt-3 space-y-1.5">
                  <Label>Reference</Label>
                  <Input
                    className="h-11"
                    value={payment.reference}
                    onChange={(event) => update(payment.id, { reference: event.target.value })}
                    placeholder={payment.method === "UPI" ? "UTR, optional" : "Reference, optional"}
                  />
                  {payment.method === "UPI" ? (
                    <p className="text-xs text-muted-foreground">
                      This records a manual UPI confirmation. It is not verified with a bank.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={payments.length >= 6}
            onClick={() =>
              onPaymentsChange([
                ...payments,
                { id: crypto.randomUUID(), method: "UPI", amount: "", reference: "" },
              ])
            }
          >
            <Plus className="h-4 w-4" />
            Split payment
          </Button>
        </div>

        {allowCreditSales ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-3">
            <div>
              <p className="text-sm font-medium">Put the balance on udhaar</p>
              <p className="text-xs text-muted-foreground">
                Partial payment and credit stay on the bill.
              </p>
            </div>
            <Switch checked={allowCredit} onCheckedChange={onAllowCreditChange} />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 text-sm">
          <Summary label="Amount received" value={formatCurrency(settlement?.amountPaid ?? 0)} />
          <Summary label="Balance due" value={formatCurrency(settlement?.balanceDue ?? grand)} />
          <Summary label="Change returned" value={formatCurrency(settlement?.changeGiven ?? 0)} />
          <Summary label="Status" value={settlement?.paymentStatus ?? (quoting ? "Calculating" : "—")} />
        </div>

        {settlement?.payments?.length ? (
          <ul className="space-y-1 text-xs text-muted-foreground">
            {settlement.payments.map((payment, index) => (
              <li key={`${payment.method}-${index}`}>
                {paymentRecordLabel(payment)} · {formatCurrency(payment.amount)}
                {payment.changeGiven > 0 ? ` · change ${formatCurrency(payment.changeGiven)}` : ""}
              </li>
            ))}
          </ul>
        ) : null}

        {quoteError ? <p className="text-sm text-destructive">{quoteError}</p> : null}

        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Back
          </Button>
          <Button
            type="button"
            className="h-11 bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={submitting || quoting || Boolean(quoteError) || !quote}
            onClick={onConfirm}
          >
            {submitting ? "Saving bill…" : "Confirm bill"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
