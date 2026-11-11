"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/dashboard/page-header";
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

type SettingsForm = {
  name: string;
  legalName: string;
  storeName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  stateCode: string;
  pincode: string;
  isGstRegistered: boolean;
  pricesIncludeGst: boolean;
  gstin: string;
};

const EMPTY: SettingsForm = {
  name: "",
  legalName: "",
  storeName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  stateCode: "",
  pincode: "",
  isGstRegistered: false,
  pricesIncludeGst: false,
  gstin: "",
};

export function BusinessSettingsForm() {
  const [form, setForm] = useState<SettingsForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchJson<{ data: SettingsForm }>("/api/settings/business")
      .then((response) => {
        if (response.data) setForm({ ...EMPTY, ...response.data });
      })
      .catch((error) => {
        toast.error(error instanceof ApiClientError ? error.message : "Could not load settings.");
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (patch: Partial<SettingsForm>) => setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await fetchJson("/api/settings/business", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      toast.success("Business settings saved.");
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading settings…</p>;

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Store identity and GST registration used by billing. Product GST rates stay on each product."
      />
      <Card>
        <CardContent className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
          <Field label="Business name" value={form.name} onChange={(name) => set({ name })} />
          <Field label="Legal name" value={form.legalName} onChange={(legalName) => set({ legalName })} />
          <Field label="Store name" value={form.storeName} onChange={(storeName) => set({ storeName })} />
          <Field label="Phone" value={form.phone} onChange={(phone) => set({ phone })} />
          <Field label="Email" value={form.email} onChange={(email) => set({ email })} />
          <Field label="Pincode" value={form.pincode} onChange={(pincode) => set({ pincode })} />
          <div className="md:col-span-2">
            <Field label="Address" value={form.address} onChange={(address) => set({ address })} />
          </div>
          <Field label="City" value={form.city} onChange={(city) => set({ city })} />
          <div className="space-y-1.5">
            <Label>State</Label>
            <Select value={form.stateCode || "none"} onValueChange={(value) => set({ stateCode: value === "none" ? "" : value })}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not set</SelectItem>
                {INDIAN_STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.code} · {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field label="GSTIN" value={form.gstin} onChange={(gstin) => set({ gstin: gstin.toUpperCase() })} />
          <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">GST registered</p>
              <p className="text-xs text-muted-foreground">Tax invoices use each product&apos;s GST rate.</p>
            </div>
            <Switch checked={form.isGstRegistered} onCheckedChange={(isGstRegistered) => set({ isGstRegistered })} />
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 md:col-span-2">
            <div>
              <p className="text-sm font-medium">Selling prices include GST</p>
              <p className="text-xs text-muted-foreground">
                Turn this on when shelf prices already contain tax. Otherwise tax is added at billing.
              </p>
            </div>
            <Switch checked={form.pricesIncludeGst} onCheckedChange={(pricesIncludeGst) => set({ pricesIncludeGst })} />
          </div>
          <div className="md:col-span-2">
            <Button type="button" className="h-11 bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input className="h-11" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
