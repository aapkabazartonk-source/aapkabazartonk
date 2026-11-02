"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { STOCK_ADJUSTMENT_TYPES } from "@/lib/constants";
import { fetchJson } from "@/lib/fetch-json";
import {
  stockAdjustmentCreateSchema,
  type StockAdjustmentCreateValues,
} from "@/lib/validators/inventory";
import type { ProductRecord } from "@/types/catalog";

interface StockAdjustmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  defaultProductId?: string;
  onSubmit: (values: StockAdjustmentCreateValues) => Promise<void>;
}

const TYPE_LABELS: Record<(typeof STOCK_ADJUSTMENT_TYPES)[number], string> = {
  STOCK_IN: "Add stock (Stock in)",
  STOCK_OUT: "Remove stock (Stock out)",
  DAMAGED: "Damaged goods",
  LOST: "Lost / missing",
  CORRECTION: "Correction (set absolute stock)",
  OPENING_STOCK: "Opening stock",
};

export function StockAdjustmentSheet({
  open,
  onOpenChange,
  submitting,
  defaultProductId,
  onSubmit,
}: StockAdjustmentSheetProps) {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const form = useForm<StockAdjustmentCreateValues>({
    resolver: zodResolver(stockAdjustmentCreateSchema) as never,
    defaultValues: {
      productId: defaultProductId ?? "",
      adjustmentType: "STOCK_IN",
      quantity: 1,
      reason: "",
      notes: "",
      referenceNumber: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      productId: defaultProductId ?? "",
      adjustmentType: "STOCK_IN",
      quantity: 1,
      reason: "",
      notes: "",
      referenceNumber: "",
    });

    let cancelled = false;
    setLoadingProducts(true);
    fetchJson<{ data: ProductRecord[] }>("/api/products?limit=100&status=active")
      .then((res) => {
        if (!cancelled) setProducts(res.data);
      })
      .catch(() => {
        if (!cancelled) setProducts([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, defaultProductId, form]);

  const adjustmentType = form.watch("adjustmentType");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="border-b border-border px-4 pb-4 sm:px-6">
          <SheetTitle>Adjust stock</SheetTitle>
          <SheetDescription>
            Every change is logged. Stock cannot go negative.
          </SheetDescription>
        </SheetHeader>

        <form
          className="space-y-5 p-4 sm:p-6"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
          })}
        >
          <div className="space-y-2">
            <Label>Product</Label>
            <Controller
              control={form.control}
              name="productId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={loadingProducts}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue
                      placeholder={
                        loadingProducts ? "Loading products..." : "Select product"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product._id} value={product._id}>
                        {product.name} ({product.sku}) · {product.currentStock}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.productId ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.productId.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Adjustment type</Label>
            <Controller
              control={form.control}
              name="adjustmentType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STOCK_ADJUSTMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-qty">
              {adjustmentType === "CORRECTION"
                ? "New absolute stock level"
                : "Quantity"}
            </Label>
            <Input
              id="adj-qty"
              type="number"
              min={0}
              step="1"
              {...form.register("quantity")}
            />
            {form.formState.errors.quantity ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.quantity.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input id="adj-reason" {...form.register("reason")} />
            {form.formState.errors.reason ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.reason.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-ref">Reference number (optional)</Label>
            <Input id="adj-ref" {...form.register("referenceNumber")} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adj-notes">Notes</Label>
            <Textarea id="adj-notes" rows={3} {...form.register("notes")} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
                "Apply adjustment"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
