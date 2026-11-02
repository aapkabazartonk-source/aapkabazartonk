"use client";

import { useEffect, useMemo } from "react";
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
import { formatCurrency } from "@/lib/utils";
import {
  purchaseCreateSchema,
  type PurchaseCreateValues,
} from "@/lib/validators/purchase";
import type { ProductRecord } from "@/types/catalog";

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
  const form = useForm<PurchaseCreateValues>({
    resolver: zodResolver(purchaseCreateSchema) as never,
    defaultValues: {
      supplierName: "",
      supplierContact: "",
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
      tax: 0,
      notes: "",
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      supplierName: "",
      supplierContact: "",
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
      tax: 0,
      notes: "",
    });
  }, [open, form]);

  // Ensure purchaseDate exists before submit if form opened oddly
  useEffect(() => {
    if (!open) return;
    if (!form.getValues("purchaseDate")) {
      form.setValue("purchaseDate", new Date());
    }
  }, [open, form]);

  const watchedItems = form.watch("items");
  const headerDiscount = Number(form.watch("discount") || 0);
  const headerTax = Number(form.watch("tax") || 0);

  const previewTotal = useMemo(() => {
    const lines = (watchedItems ?? []).reduce((sum, item) => {
      const gross = Number(item.quantity || 0) * Number(item.purchasePrice || 0);
      const afterDiscount = Math.max(0, gross - Number(item.discount || 0));
      const tax = afterDiscount * (Number(item.taxRate || 0) / 100);
      return sum + afterDiscount + tax;
    }, 0);
    return Math.max(0, lines - headerDiscount + headerTax);
  }, [watchedItems, headerDiscount, headerTax]);

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
              <Label htmlFor="supplier-name">Supplier name</Label>
              <Input id="supplier-name" {...form.register("supplierName")} />
              {form.formState.errors.supplierName ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.supplierName.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="supplier-contact">Supplier contact</Label>
              <Input
                id="supplier-contact"
                {...form.register("supplierContact")}
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
                    <Label>Tax rate %</Label>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Header discount</Label>
              <Input type="number" min={0} step="0.01" {...form.register("discount")} />
            </div>
            <div className="space-y-2">
              <Label>Header tax</Label>
              <Input type="number" min={0} step="0.01" {...form.register("tax")} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/50 px-4 py-3 text-sm">
            Estimated total:{" "}
            <span className="font-semibold">{formatCurrency(previewTotal)}</span>
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
