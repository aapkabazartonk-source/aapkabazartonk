"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { INDIAN_STATES } from "@/lib/india-states";
import {
  supplierFormSchema,
  type SupplierFormValues,
} from "@/lib/validators/supplier";
import type { SupplierRecord } from "@/types/suppliers";

interface SupplierFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: SupplierRecord | null;
  allowOpeningBalanceEdit?: boolean;
  submitting: boolean;
  onSubmit: (values: SupplierFormValues) => Promise<void>;
}

export function SupplierFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  allowOpeningBalanceEdit = true,
  submitting,
  onSubmit,
}: SupplierFormSheetProps) {
  const form = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema) as never,
    defaultValues: {
      name: "",
      contactPerson: "",
      phone: "",
      email: "",
      gstin: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      openingBalance: 0,
      notes: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initialData?.name ?? "",
      contactPerson: initialData?.contactPerson ?? "",
      phone: initialData?.phone ?? "",
      email: initialData?.email ?? "",
      gstin: initialData?.gstin ?? "",
      address: initialData?.address ?? "",
      city: initialData?.city ?? "",
      state: initialData?.state ?? "",
      pincode: initialData?.pincode ?? "",
      openingBalance: initialData?.openingBalance ?? 0,
      notes: initialData?.notes ?? "",
      isActive: initialData?.isActive ?? true,
    });
  }, [open, initialData, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>
            {mode === "create" ? "Add supplier" : "Edit supplier"}
          </SheetTitle>
          <SheetDescription>
            Supplier contacts and payables for purchase receiving.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-5 p-4 sm:p-6"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="supplier-name">Supplier name</Label>
            <Input id="supplier-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact-person">Contact person</Label>
              <Input id="contact-person" {...form.register("contactPerson")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-phone">Phone</Label>
              <Input id="supplier-phone" {...form.register("phone")} />
              {form.formState.errors.phone ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="supplier-email">Email</Label>
              <Input id="supplier-email" type="email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-gstin">GSTIN</Label>
              <Input
                id="supplier-gstin"
                {...form.register("gstin")}
                onChange={(e) =>
                  form.setValue("gstin", e.target.value.toUpperCase())
                }
              />
              {form.formState.errors.gstin ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.gstin.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier-address">Address</Label>
            <Textarea id="supplier-address" rows={2} {...form.register("address")} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="supplier-city">City</Label>
              <Input id="supplier-city" {...form.register("city")} />
            </div>
            <div className="space-y-2">
              <Label>State</Label>
              <Controller
                control={form.control}
                name="state"
                render={({ field }) => (
                  <Select
                    value={field.value || "__none"}
                    onValueChange={(value) =>
                      field.onChange(value === "__none" ? "" : value)
                    }
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Not set</SelectItem>
                      {INDIAN_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.name}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-pincode">Pincode</Label>
              <Input id="supplier-pincode" {...form.register("pincode")} />
              {form.formState.errors.pincode ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.pincode.message}
                </p>
              ) : null}
            </div>
          </div>

          {(mode === "create" || allowOpeningBalanceEdit) && (
            <div className="space-y-2">
              <Label htmlFor="opening-balance">Opening balance (payable)</Label>
              <Input
                id="opening-balance"
                type="number"
                min={0}
                step="0.01"
                {...form.register("openingBalance")}
              />
              <p className="text-xs text-muted-foreground">
                Positive balance means amount payable to this supplier.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="supplier-notes">Notes</Label>
            <Textarea id="supplier-notes" rows={3} {...form.register("notes")} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive suppliers cannot be used on new purchases.
              </p>
            </div>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : mode === "create" ? (
                "Add supplier"
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
