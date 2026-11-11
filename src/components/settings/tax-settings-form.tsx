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
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { INDIAN_STATES } from "@/lib/india-states";

type TaxForm = {
  isGstRegistered: boolean;
  pricesIncludeGst: boolean;
  gstin: string;
  stateCode: string;
  invoiceEligibility?: string;
  notes?: string;
};

const EMPTY: TaxForm = {
  isGstRegistered: false,
  pricesIncludeGst: false,
  gstin: "",
  stateCode: "",
};

export function TaxSettingsForm() {
  const [form, setForm] = useState<TaxForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ data: TaxForm }>("/api/settings/tax")
      .then((response) => {
        if (response.data) setForm({ ...EMPTY, ...response.data });
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError ? error.message : "Could not load tax settings.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const response = await fetchJson<{ data: TaxForm }>("/api/settings/tax", {
        method: "PATCH",
        body: JSON.stringify({
          isGstRegistered: form.isGstRegistered,
          pricesIncludeGst: form.pricesIncludeGst,
          gstin: form.gstin,
          stateCode: form.stateCode,
        }),
      });
      setForm({ ...EMPTY, ...response.data });
      toast.success("Tax settings saved.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : "Could not save tax settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="GST & tax"
      description="Controls POS tax calculations. Completed invoices keep their original tax snapshot."
    >
      <Card>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">GST registered</p>
                  <p className="text-xs text-muted-foreground">
                    Unregistered businesses can only issue bills of supply.
                  </p>
                </div>
                <Switch
                  checked={form.isGstRegistered}
                  onCheckedChange={(isGstRegistered) =>
                    setForm((current) => ({ ...current, isGstRegistered }))
                  }
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Prices include GST</p>
                  <p className="text-xs text-muted-foreground">
                    When on, product selling prices are treated as tax-inclusive.
                  </p>
                </div>
                <Switch
                  checked={form.pricesIncludeGst}
                  onCheckedChange={(pricesIncludeGst) =>
                    setForm((current) => ({ ...current, pricesIncludeGst }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>GSTIN</Label>
                  <Input
                    value={form.gstin}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        gstin: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="22AAAAA0000A1Z5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>State (for CGST/SGST vs IGST)</Label>
                  <Select
                    value={form.stateCode || "__none"}
                    onValueChange={(value) =>
                      setForm((current) => ({
                        ...current,
                        stateCode: value === "__none" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Not set</SelectItem>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.code} · {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl bg-secondary/50 px-4 py-3 text-sm">
                <p className="font-medium">Invoice eligibility</p>
                <p className="mt-1 text-muted-foreground">
                  {form.isGstRegistered
                    ? "Tax invoices when any line has GST &gt; 0; otherwise bill of supply."
                    : "Bill of supply only. Tax invoices are blocked for unregistered businesses."}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  CGST/SGST apply for intra-state supply; IGST for inter-state. HSN/SAC and GST
                  rates are configured per product — not as a single hard-coded business rate.
                </p>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save tax settings"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </SettingsShell>
  );
}
