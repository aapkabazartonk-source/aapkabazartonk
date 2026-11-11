"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
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
import { BUSINESS_TYPES } from "@/lib/constants";
import { ApiClientError, fetchJson } from "@/lib/fetch-json";
import { INDIAN_STATES } from "@/lib/india-states";

async function uploadBusinessLogo(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/uploads/business-logo", {
    method: "POST",
    body,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : `Upload failed with status ${response.status}`;
    throw new ApiClientError(message, response.status);
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    !("url" in payload) ||
    typeof (payload as { url: unknown }).url !== "string"
  ) {
    throw new ApiClientError("Upload response was invalid.", 500);
  }

  return (payload as { url: string }).url;
}

type ProfileForm = {
  name: string;
  legalName: string;
  ownerName: string;
  storeName: string;
  logoUrl: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  stateCode: string;
  pincode: string;
  country: string;
  businessType: string;
  financialYearStartMonth: number;
};

const EMPTY: ProfileForm = {
  name: "",
  legalName: "",
  ownerName: "",
  storeName: "",
  logoUrl: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  stateCode: "",
  pincode: "",
  country: "India",
  businessType: "retail",
  financialYearStartMonth: 4,
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function BusinessProfileForm() {
  const [form, setForm] = useState<ProfileForm>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchJson<{ data: ProfileForm }>("/api/settings/business")
      .then((response) => {
        if (response.data) setForm({ ...EMPTY, ...response.data });
      })
      .catch((error) => {
        toast.error(
          error instanceof ApiClientError
            ? error.message
            : "Could not load business profile.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  const set = (patch: Partial<ProfileForm>) =>
    setForm((current) => ({ ...current, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await fetchJson("/api/settings/business", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      window.dispatchEvent(
        new CustomEvent("owner-name-updated", {
          detail: form.ownerName.trim(),
        }),
      );
      toast.success("Business profile saved.");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError
          ? error.message
          : "Could not save business profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Business profile"
      description="Identity and address details used on invoices and receipts."
    >
      <Card>
        <CardContent className="space-y-5">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-start sm:p-5">
                <button
                  type="button"
                  className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary/40"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo || saving}
                  aria-label="Upload business logo"
                >
                  <LogoPreview url={form.logoUrl} name={form.name} />
                  {uploadingLogo ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                      <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                    </div>
                  ) : null}
                </button>
                <div className="min-w-0 flex-1 space-y-3 pt-0.5">
                  <div className="space-y-1">
                    <Label>Business logo</Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Upload a logo to Cloudinary. It is snapshotted onto each
                      sale invoice.
                    </p>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="sr-only"
                    disabled={uploadingLogo || saving}
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;

                      setUploadingLogo(true);
                      try {
                        const uploadedUrl = await uploadBusinessLogo(file);
                        set({ logoUrl: uploadedUrl });
                        toast.success("Logo uploaded. Save profile to keep it.");
                      } catch (error) {
                        toast.error(
                          error instanceof ApiClientError
                            ? error.message
                            : "Could not upload logo.",
                        );
                      } finally {
                        setUploadingLogo(false);
                      }
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingLogo || saving}
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {uploadingLogo ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Uploading…
                        </>
                      ) : (
                        <>
                          <ImagePlus className="h-4 w-4" />
                          {form.logoUrl ? "Replace logo" : "Upload logo"}
                        </>
                      )}
                    </Button>
                    {form.logoUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={uploadingLogo || saving}
                        onClick={() => set({ logoUrl: "" })}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Business name">
                  <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
                </Field>
                <Field label="Legal name">
                  <Input
                    value={form.legalName}
                    onChange={(e) => set({ legalName: e.target.value })}
                  />
                </Field>
                <Field label="Owner name">
                  <Input
                    value={form.ownerName}
                    onChange={(e) => set({ ownerName: e.target.value })}
                  />
                </Field>
                <Field label="Store name">
                  <Input
                    value={form.storeName}
                    onChange={(e) => set({ storeName: e.target.value })}
                  />
                </Field>
                <Field label="Phone">
                  <Input value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => set({ email: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Address">
                <Input
                  value={form.address}
                  onChange={(e) => set({ address: e.target.value })}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="City">
                  <Input value={form.city} onChange={(e) => set({ city: e.target.value })} />
                </Field>
                <Field label="State">
                  <Select
                    value={form.stateCode || "__none"}
                    onValueChange={(value) =>
                      set({ stateCode: value === "__none" ? "" : value })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Not set</SelectItem>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="PIN code">
                  <Input
                    value={form.pincode}
                    onChange={(e) => set({ pincode: e.target.value })}
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Country">
                  <Input
                    value={form.country}
                    onChange={(e) => set({ country: e.target.value })}
                  />
                </Field>
                <Field label="Business type">
                  <Select
                    value={form.businessType}
                    onValueChange={(value) => set({ businessType: value })}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Financial year starts">
                  <Select
                    value={String(form.financialYearStartMonth)}
                    onValueChange={(value) =>
                      set({ financialYearStartMonth: Number(value) })
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month, index) => (
                        <SelectItem key={month} value={String(index + 1)}>
                          {month}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => void save()} disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
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

function LogoPreview({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  if (url && !broken) {
    // Cloudinary / remote logo URLs; next/image needs a remote pattern per host.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={`${name || "Business"} logo`}
        className="h-full w-full object-contain p-2"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span className="flex flex-col items-center gap-1 px-2 text-center text-[11px] leading-tight text-muted-foreground">
      <ImagePlus className="h-5 w-5" />
      {url ? "Invalid" : "No logo"}
    </span>
  );
}
