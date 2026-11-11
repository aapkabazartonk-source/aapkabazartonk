"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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

type PrinterForm = {
  defaultPrinterLabel: string;
  paperSize: string;
  autoPrintAfterBilling: boolean;
  printLogo: boolean;
  printPreview: boolean;
  notes: string;
};

const EMPTY: PrinterForm = {
  defaultPrinterLabel: "Browser default",
  paperSize: "80mm",
  autoPrintAfterBilling: false,
  printLogo: true,
  printPreview: true,
  notes: "",
};

export function PrinterSettingsForm() {
  const [form, setForm] = useState<PrinterForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ data: PrinterForm }>("/api/settings/printer")
      .then((response) => {
        if (response.data) setForm({ ...EMPTY, ...response.data });
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : "Could not load printer settings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetchJson<{ data: PrinterForm }>(
        "/api/settings/printer",
        { method: "PATCH", body: JSON.stringify(form) },
      );
      setForm({ ...EMPTY, ...response.data });
      toast.success("Printer preferences saved.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save printer settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Printer settings"
      description="Browser printing for thermal and A4 layouts. USB discovery is not implemented."
    >
      <Card>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Default printer label</Label>
                <Input
                  value={form.defaultPrinterLabel}
                  onChange={(e) =>
                    setForm((c) => ({
                      ...c,
                      defaultPrinterLabel: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Reminder label only — the OS print dialog chooses the actual printer.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Paper size</Label>
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
              </div>

              <Toggle
                label="Auto print after successful billing"
                description="Opens the invoice print page with autoprint when supported by the browser."
                checked={form.autoPrintAfterBilling}
                onChange={(autoPrintAfterBilling) =>
                  setForm((c) => ({ ...c, autoPrintAfterBilling }))
                }
              />
              <Toggle
                label="Print logo"
                checked={form.printLogo}
                onChange={(printLogo) => setForm((c) => ({ ...c, printLogo }))}
              />
              <Toggle
                label="Show print preview"
                checked={form.printPreview}
                onChange={(printPreview) =>
                  setForm((c) => ({ ...c, printPreview }))
                }
              />

              <div className="space-y-2">
                <Label>Notes / limitations</Label>
                <Textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) =>
                    setForm((c) => ({ ...c, notes: e.target.value }))
                  }
                />
              </div>

              <div className="rounded-xl bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
                Browser and OS limitations: silent USB printing and automatic
                thermal printer discovery are not available in this web app.
                Staff must confirm the printer in the browser print dialog.
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save printer settings"}
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
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
