"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";
import {
  customerFormSchema,
  type CustomerFormValues,
} from "@/lib/validators/customer";
import type { CustomerRecord } from "@/types/customers";

interface CustomerFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: CustomerRecord | null;
  submitting: boolean;
  onSubmit: (values: CustomerFormValues) => Promise<void>;
}

export function CustomerFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  submitting,
  onSubmit,
}: CustomerFormSheetProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema) as never,
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      city: "",
      state: "",
      pincode: "",
      gstin: "",
      customerType: "INDIVIDUAL",
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initialData?.name ?? "",
      phone: initialData?.phone ?? "",
      email: initialData?.email ?? "",
      address: initialData?.address ?? "",
      city: initialData?.city ?? "",
      state: initialData?.state ?? "",
      pincode: initialData?.pincode ?? "",
      gstin: initialData?.gstin ?? "",
      customerType: initialData?.customerType ?? "INDIVIDUAL",
      isActive: initialData?.isActive ?? true,
    });
  }, [open, initialData, form]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border pb-4 pl-1">
          <SheetTitle>
            {mode === "create" ? "Add customer" : "Edit customer"}
          </SheetTitle>
          <SheetDescription>
            Optional billing contacts for invoices. Walk-in sales stay available
            without a customer.
          </SheetDescription>
        </SheetHeader>

        <form
          className="mt-6 space-y-4 pl-4"
          onSubmit={form.handleSubmit((values) => onSubmit(values))}
        >
          <div className="space-y-2">
            <Label htmlFor="customer-name">Customer name *</Label>
            <Input id="customer-name" {...form.register("name")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Mobile number *</Label>
            <Input id="customer-phone" {...form.register("phone")} />
            {form.formState.errors.phone ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">Email</Label>
            <Input id="customer-email" type="email" {...form.register("email")} />
            {form.formState.errors.email ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Customer type</Label>
            <Controller
              control={form.control}
              name="customerType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="BUSINESS">Business</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-address">Address</Label>
            <Input id="customer-address" {...form.register("address")} />
          </div>

          {mode === "edit" ? (
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">
                  Inactive customers cannot be selected at POS.
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
          ) : null}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving
                </>
              ) : mode === "create" ? (
                "Add customer"
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
