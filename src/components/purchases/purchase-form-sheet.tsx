"use client";

import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchJson } from "@/lib/fetch-json";
import { formatCurrency } from "@/lib/utils";
import {
  purchaseCreateSchema,
  type PurchaseCreateValues,
} from "@/lib/validators/purchase";
import type { ProductRecord } from "@/types/catalog";
import type { SupplierOption } from "@/types/suppliers";

interface PurchaseFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: ProductRecord[];
  submitting: boolean;
  onSubmit: (values: PurchaseCreateValues) => Promise<void>;
}

export function PurchaseFormSheet({
  open,
  onOpenChange,
  products,
  submitting,
  onSubmit,
}: PurchaseFormSheetProps) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [selectedGstin, setSelectedGstin] = useState("");

  const form = useForm<PurchaseCreateValues>({
    resolver: zodResolver(purchaseCreateSchema) as never,
    defaultValues: {
      supplierId: null,
      supplierName: "",
      supplierContact: "",
      supplierInvoiceNumber: "",
      expectedDeliveryDate: null,
      items: [
        {
          productId: "",
          quantity: 1,
          purchasePrice: 0,
          taxRate: 0,
          discount: 0,
        },
      ],
      discount: 0,
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (!open) return;
    fetchJson<{ data: SupplierOption[] }>("/api/suppliers?options=1")
      .then((res) => setSuppliers(res.data))
      .catch(() => setSuppliers([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSelectedGstin("");
    form.reset({
      supplierId: null,
      supplierName: "",
      supplierContact: "",
      supplierInvoiceNumber: "",
      purchaseDate: new Date(),
      expectedDeliveryDate: null,
      items: [
        {
          productId: "",
          quantity: 1,
          purchasePrice: 0,
          taxRate: 0,
          discount: 0,
        },
      ],
      discount: 0,
      notes: "",
    });
  }, [open, form]);

  function applySupplier(supplierId: string) {
    const supplier = suppliers.find((row) => row._id === supplierId);
    if (!supplier) return;
    form.setValue("supplierId", supplier._id);
    form.setValue("supplierName", supplier.name);
    form.setValue("supplierContact", supplier.phone ?? "");
    setSelectedGstin(supplier.gstin ?? "");
  }

  // Ensure purchaseDate exists before submit if form opened oddly
  useEffect(() => {
    if (!open) return;
    if (!form.getValues("purchaseDate")) {
      form.setValue("purchaseDate", new Date());
    }
  }, [open, form]);

  const watchedItems = form.watch("items");
  const headerDiscount = Number(form.watch("discount") || 0);

  const preview = useMemo(() => {
    const items = watchedItems ?? [];
    const subtotal = items.reduce(
      (sum, item) =>
        sum + Number(item.quantity || 0) * Number(item.purchasePrice || 0),
      0,
    );
    const lineDiscount = items.reduce((sum, item) => {
      const gross = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
      return sum + Math.min(gross, Number(item.discount || 0));
    }, 0);
    const tax = items.reduce((sum, item) => {
      const gross = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
      const taxable = Math.max(0, gross - Number(item.discount || 0));
      return sum + taxable * (Number(item.taxRate || 0) / 100);
    }, 0);
    const total = Math.max(0, subtotal - lineDiscount - headerDiscount + tax);
    return { subtotal, discount: lineDiscount + headerDiscount, tax, total };
  }, [watchedItems, headerDiscount]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="border-b border-border px-4 pb-4 sm:px-6">
          <SheetTitle>New purchase draft</SheetTitle>
          <SheetDescription>
            Drafts do not change stock. Receive the purchase to add inventory.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-5 p-4 sm:p-6"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
          })}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Supplier</Label>
              <Controller
                control={form.control}
                name="supplierId"
                render={({ field }) => (
                  <Select
                    value={field.value ?? undefined}
                    onValueChange={(value) => {
                      field.onChange(value);
                      applySupplier(value);
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select an active supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier._id} value={supplier._id}>
                          {supplier.name} · {supplier.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {suppliers.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active suppliers found. Add a supplier first.
                </p>
              ) : null}
              {form.formState.errors.supplierName ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.supplierName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-name">Supplier name</Label>
              <Input id="supplier-name" {...form.register("supplierName")} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-contact">Supplier phone</Label>
              <Input
                id="supplier-contact"
                {...form.register("supplierContact")}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label>GSTIN snapshot</Label>
              <Input value={selectedGstin || "—"} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier-invoice">Supplier invoice number</Label>
              <Input
                id="supplier-invoice"
                {...form.register("supplierInvoiceNumber")}
                placeholder="Optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-date">Purchase date</Label>
              <Input
                id="purchase-date"
                type="date"
                value={
                  form.watch("purchaseDate")
                    ? new Date(form.watch("purchaseDate") as Date)
                        .toISOString()
                        .slice(0, 10)
                    : ""
                }
                onChange={(e) =>
                  form.setValue(
                    "purchaseDate",
                    e.target.value ? new Date(e.target.value) : new Date(),
                  )
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expected-date">Expected delivery</Label>
              <Input
                id="expected-date"
                type="date"
                onChange={(e) =>
                  form.setValue(
                    "expectedDeliveryDate",
                    e.target.value ? new Date(e.target.value) : null,
                  )
                }
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Products</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  append({
                    productId: "",
                    quantity: 1,
                    purchasePrice: 0,
                    taxRate: 0,
                    discount: 0,
                  })
                }
              >
                <Plus className="h-4 w-4" />
                Add line
              </Button>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="space-y-3 rounded-xl border border-border p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-2">
                    <Label>Product</Label>
                    <Controller
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field: productField }) => (
                        <Select
                          value={productField.value}
                          onValueChange={(value) => {
                            productField.onChange(value);
                            const product = products.find((p) => p._id === value);
                            if (product) {
                              form.setValue(
                                `items.${index}.purchasePrice`,
                                product.purchasePrice,
                              );
                            }
                          }}
                        >
                          <SelectTrigger className="rounded-xl">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product._id} value={product._id}>
                                {product.name} ({product.sku})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  {fields.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      {...form.register(`items.${index}.quantity`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Purchase price</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...form.register(`items.${index}.purchasePrice`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>GST rate %</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...form.register(`items.${index}.taxRate`)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Line discount</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...form.register(`items.${index}.discount`)}
                    />
                  </div>
                </div>
              </div>
            ))}
            {form.formState.errors.items ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.items.message ||
                  "Check purchase line items"}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Invoice discount</Label>
            <Input type="number" min={0} step="0.01" {...form.register("discount")} />
            <p className="text-xs text-muted-foreground">
              GST is calculated on each line. Leave the rate at 0 for non-GST
              purchases. Drafts do not change stock.
            </p>
          </div>

          <div className="space-y-1 rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(preview.subtotal)}</span>
            </p>
            <p className="flex justify-between">
              <span>Discount</span>
              <span>{formatCurrency(preview.discount)}</span>
            </p>
            <p className="flex justify-between">
              <span>GST</span>
              <span>{formatCurrency(preview.tax)}</span>
            </p>
            <p className="flex justify-between font-semibold">
              <span>Total</span>
              <span>{formatCurrency(preview.total)}</span>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchase-notes">Notes</Label>
            <Textarea id="purchase-notes" rows={3} {...form.register("notes")} />
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
              ) : (
                "Save draft"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
