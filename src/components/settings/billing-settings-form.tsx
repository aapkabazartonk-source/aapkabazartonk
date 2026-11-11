"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { TENDER_METHODS } from "@/lib/constants";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";

type BillingForm = {
  defaultPaymentMethod: string;
  enabledPaymentMethods: string[];
  enableBillDiscount: boolean;
  maxBillDiscountPercent: number;
  maxBillDiscountAmount: number;
  defaultInvoiceTypePreference: string;
  showStockAvailability: boolean;
  searchIncludesBarcode: boolean;
  searchIncludesSku: boolean;
  requireCheckoutConfirmation: boolean;
  autoPrintAfterBilling: boolean;
  allowCreditSales: boolean;
  keyboardShortcutsEnabled: boolean;
};

const EMPTY: BillingForm = {
  defaultPaymentMethod: "CASH",
  enabledPaymentMethods: [...TENDER_METHODS],
  enableBillDiscount: true,
  maxBillDiscountPercent: 100,
  maxBillDiscountAmount: 0,
  defaultInvoiceTypePreference: "AUTO",
  showStockAvailability: true,
  searchIncludesBarcode: true,
  searchIncludesSku: true,
  requireCheckoutConfirmation: true,
  autoPrintAfterBilling: false,
  allowCreditSales: true,
  keyboardShortcutsEnabled: true,
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

export function BillingSettingsForm() {
  const [form, setForm] = useState<BillingForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ data: BillingForm }>("/api/settings/billing")
      .then((response) => {
        if (response.data) setForm({ ...EMPTY, ...response.data });
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : "Could not load billing settings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleMethod = (method: string) => {
    setForm((current) => {
      const enabled = current.enabledPaymentMethods.includes(method)
        ? current.enabledPaymentMethods.filter((item) => item !== method)
        : [...current.enabledPaymentMethods, method];
      return {
        ...current,
        enabledPaymentMethods: enabled,
        defaultPaymentMethod: enabled.includes(current.defaultPaymentMethod)
          ? current.defaultPaymentMethod
          : enabled[0] ?? "CASH",
      };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetchJson<{ data: BillingForm }>(
        "/api/settings/billing",
        { method: "PATCH", body: JSON.stringify(form) },
      );
      setForm({ ...EMPTY, ...response.data });
      toast.success("Billing preferences saved and applied to POS.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save billing settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Billing preferences"
      description="These settings control POS checkout, discounts, and payment methods."
    >
      <Card>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Enabled payment methods</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TENDER_METHODS.map((method) => (
                    <label
                      key={method}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                    >
                      <span>{METHOD_LABELS[method] ?? method}</span>
                      <Switch
                        checked={form.enabledPaymentMethods.includes(method)}
                        onCheckedChange={() => toggleMethod(method)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Default payment method</Label>
                <Select
                  value={form.defaultPaymentMethod}
                  onValueChange={(defaultPaymentMethod) =>
                    setForm((c) => ({ ...c, defaultPaymentMethod }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {form.enabledPaymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        {METHOD_LABELS[method] ?? method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Toggle
                label="Enable bill discount"
                checked={form.enableBillDiscount}
                onChange={(enableBillDiscount) =>
                  setForm((c) => ({ ...c, enableBillDiscount }))
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Max discount %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.maxBillDiscountPercent}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        maxBillDiscountPercent: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max discount amount (0 = no amount cap)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.maxBillDiscountAmount}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        maxBillDiscountAmount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Cashiers without discount override permission cannot exceed these limits.
                Negative stock remains prohibited.
              </p>

              <div className="space-y-2">
                <Label>Default invoice type preference</Label>
                <Select
                  value={form.defaultInvoiceTypePreference}
                  onValueChange={(defaultInvoiceTypePreference) =>
                    setForm((c) => ({ ...c, defaultInvoiceTypePreference }))
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AUTO">Auto (from GST rules)</SelectItem>
                    <SelectItem value="TAX_INVOICE">Prefer tax invoice</SelectItem>
                    <SelectItem value="BILL_OF_SUPPLY">Prefer bill of supply</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Toggle
                label="Show stock availability"
                checked={form.showStockAvailability}
                onChange={(showStockAvailability) =>
                  setForm((c) => ({ ...c, showStockAvailability }))
                }
              />
              <Toggle
                label="Search includes barcode"
                checked={form.searchIncludesBarcode}
                onChange={(searchIncludesBarcode) =>
                  setForm((c) => ({ ...c, searchIncludesBarcode }))
                }
              />
              <Toggle
                label="Search includes SKU"
                checked={form.searchIncludesSku}
                onChange={(searchIncludesSku) =>
                  setForm((c) => ({ ...c, searchIncludesSku }))
                }
              />
              <Toggle
                label="Require checkout confirmation"
                checked={form.requireCheckoutConfirmation}
                onChange={(requireCheckoutConfirmation) =>
                  setForm((c) => ({ ...c, requireCheckoutConfirmation }))
                }
              />
              <Toggle
                label="Auto print after billing"
                checked={form.autoPrintAfterBilling}
                onChange={(autoPrintAfterBilling) =>
                  setForm((c) => ({ ...c, autoPrintAfterBilling }))
                }
              />
              <Toggle
                label="Allow credit / udhaar sales"
                checked={form.allowCreditSales}
                onChange={(allowCreditSales) =>
                  setForm((c) => ({ ...c, allowCreditSales }))
                }
              />
              <Toggle
                label="Keyboard shortcuts"
                checked={form.keyboardShortcutsEnabled}
                onChange={(keyboardShortcutsEnabled) =>
                  setForm((c) => ({ ...c, keyboardShortcutsEnabled }))
                }
              />

              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save billing settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </SettingsShell>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
      <p className="text-sm font-medium">{label}</p>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
