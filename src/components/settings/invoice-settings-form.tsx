"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { InvoiceDocument } from "@/components/billing/invoice-document";
import { SettingsShell } from "@/components/settings/settings-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { INVOICE_PAPER_SIZES } from "@/lib/constants";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import type { PaymentRecord, SaleRecord } from "@/types/billing";

type InvoiceForm = {
  taxInvoicePrefix: string;
  billOfSupplyPrefix: string;
  salePrefix: string;
  paperSize: string;
  showLogo: boolean;
  showGstin: boolean;
  showAddress: boolean;
  footerNote: string;
  termsAndConditions: string;
  thankYouMessage: string;
  template: "standard";
};

const EMPTY: InvoiceForm = {
  taxInvoicePrefix: "INV",
  billOfSupplyPrefix: "BOS",
  salePrefix: "SAL",
  paperSize: "80mm",
  showLogo: true,
  showGstin: true,
  showAddress: true,
  footerNote: "",
  termsAndConditions: "",
  thankYouMessage: "Thank you for shopping with us!",
  template: "standard",
};

export function InvoiceSettingsForm() {
  const [form, setForm] = useState<InvoiceForm>(EMPTY);
  const [profile, setProfile] = useState({
    name: "Aapka Bazar",
    legalName: "",
    logoUrl: "",
    phone: "",
    address: "",
    storeName: "Main store",
    gstin: "",
    isGstRegistered: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchJson<{ data: InvoiceForm }>("/api/settings/invoice"),
      fetchJson<{
        data: {
          name: string;
          legalName: string;
          logoUrl: string;
          phone: string;
          address: string;
          storeName: string;
          gstin: string;
          isGstRegistered: boolean;
        };
      }>("/api/settings/business"),
    ])
      .then(([invoice, business]) => {
        if (invoice.data) setForm({ ...EMPTY, ...invoice.data });
        if (business.data) setProfile((current) => ({ ...current, ...business.data }));
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : "Could not load invoice settings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const previewSale = useMemo(() => {
    const sale: SaleRecord = {
      _id: "preview",
      saleNumber: `${form.salePrefix}-20260101-0001`,
      invoiceNumber: `${form.taxInvoicePrefix}-20260101-0001`,
      invoiceType: "TAX_INVOICE",
      supplyType: "INTRA",
      pricesIncludeGst: false,
      subtotal: 100,
      itemDiscount: 0,
      billDiscount: 0,
      taxableAmount: 100,
      cgst: 9,
      sgst: 9,
      igst: 0,
      totalTax: 18,
      grandTotal: 118,
      amountPaid: 118,
      balanceDue: 0,
      changeGiven: 0,
      paymentStatus: "PAID",
      saleStatus: "COMPLETED",
      notes: "",
      createdAt: new Date().toISOString(),
      items: [
        {
          productName: "Sample product",
          sku: "SKU-1",
          barcode: "",
          quantity: 1,
          unit: "piece",
          unitPrice: 100,
          discount: 0,
          billDiscountShare: 0,
          hsn: "1006",
          taxRate: 18,
          taxableAmount: 100,
          cgst: 9,
          sgst: 9,
          igst: 0,
          taxAmount: 18,
          finalAmount: 118,
        },
      ],
      invoiceSnapshot: {
        businessName: profile.name,
        legalName: profile.legalName,
        gstin: profile.gstin,
        isGstRegistered: profile.isGstRegistered,
        stateCode: "08",
        stateName: "Rajasthan",
        address: form.showAddress ? profile.address : "",
        phone: profile.phone,
        storeName: profile.storeName,
        storeCode: "MAIN",
        pricesIncludeGst: false,
        customerName: "Walk-in customer",
        customerPhone: "",
        customerGstin: "",
        customerAddress: "",
        customerStateCode: "",
        customerStateName: "",
        supplyType: "INTRA",
        placeOfSupply: "Rajasthan",
        logoUrl: form.showLogo ? profile.logoUrl : "",
        footerNote: form.footerNote,
        termsAndConditions: form.termsAndConditions,
        thankYouMessage: form.thankYouMessage,
        paperSize: form.paperSize,
        showGstin: form.showGstin,
        showLogo: form.showLogo,
        showAddress: form.showAddress,
      },
    };
    return sale;
  }, [form, profile]);

  const previewPayments: PaymentRecord[] = [
    {
      _id: "p1",
      paymentMethod: "CASH",
      amount: 118,
      tenderedAmount: 118,
      changeGiven: 0,
      referenceNumber: "",
      status: "CONFIRMED",
      verification: "NOT_APPLICABLE",
    },
  ];

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetchJson<{ data: InvoiceForm }>("/api/settings/invoice", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setForm({ ...EMPTY, ...response.data });
      toast.success("Invoice settings saved. New sales use these prefixes; old invoices stay unchanged.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save invoice settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Invoice settings"
      description="Prefixes are concurrency-safe. Changing a prefix never rewrites historical invoice numbers."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="space-y-5">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Tax invoice prefix">
                    <Input
                      value={form.taxInvoicePrefix}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          taxInvoicePrefix: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Bill of supply prefix">
                    <Input
                      value={form.billOfSupplyPrefix}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          billOfSupplyPrefix: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Sale prefix">
                    <Input
                      value={form.salePrefix}
                      onChange={(e) =>
                        setForm((c) => ({
                          ...c,
                          salePrefix: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </Field>
                </div>

                <Field label="Paper size">
                  <Select
                    value={form.paperSize}
                    onValueChange={(paperSize) =>
                      setForm((c) => ({ ...c, paperSize }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVOICE_PAPER_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Toggle
                  label="Show logo"
                  checked={form.showLogo}
                  onChange={(showLogo) => setForm((c) => ({ ...c, showLogo }))}
                />
                <Toggle
                  label="Show GSTIN"
                  checked={form.showGstin}
                  onChange={(showGstin) => setForm((c) => ({ ...c, showGstin }))}
                />
                <Toggle
                  label="Show address"
                  checked={form.showAddress}
                  onChange={(showAddress) => setForm((c) => ({ ...c, showAddress }))}
                />

                <Field label="Footer note">
                  <Textarea
                    rows={2}
                    value={form.footerNote}
                    onChange={(e) =>
                      setForm((c) => ({ ...c, footerNote: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Terms and conditions">
                  <Textarea
                    rows={3}
                    value={form.termsAndConditions}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        termsAndConditions: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Thank-you message">
                  <Input
                    value={form.thankYouMessage}
                    onChange={(e) =>
                      setForm((c) => ({
                        ...c,
                        thankYouMessage: e.target.value,
                      }))
                    }
                  />
                </Field>

                <div className="flex justify-end">
                  <Button onClick={() => void save()} disabled={saving}>
                    {saving ? "Saving…" : "Save invoice settings"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 overflow-auto p-4">
            <p className="text-sm font-medium">Live preview</p>
            <div className="overflow-auto rounded-xl border border-border bg-neutral-100 p-3">
              <InvoiceDocument
                sale={previewSale}
                payments={previewPayments}
                format={
                  form.paperSize === "58mm" ||
                  form.paperSize === "80mm" ||
                  form.paperSize === "A4" ||
                  form.paperSize === "6x4"
                    ? form.paperSize
                    : "80mm"
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SettingsShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
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
