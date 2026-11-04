"use client";

import { useEffect, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { PRODUCT_UNITS } from "@/lib/constants";
import { generateSku } from "@/lib/slug";
import { formatCurrency } from "@/lib/utils";
import {
  productFormSchema,
  type ProductFormValues,
} from "@/lib/validators/product";
import type { CategoryRecord, ProductRecord } from "@/types/catalog";

interface ProductFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: ProductRecord | null;
  categories: CategoryRecord[];
  submitting: boolean;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}

function idOf(value: ProductRecord["category"] | null | undefined) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._id;
}

export function ProductFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  categories,
  submitting,
  onSubmit,
}: ProductFormSheetProps) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as never,
    defaultValues: {
      name: "",
      sku: "",
      barcode: "",
      description: "",
      category: "",
      subcategory: null,
      purchasePrice: 0,
      sellingPrice: 0,
      currentStock: 0,
      minStockLevel: 5,
      unit: "piece",
      hsn: "",
      gstRate: 0,
      images: [""],
      isActive: true,
    },
  });

  const selectedCategory = form.watch("category");
  const imageValues = form.watch("images") ?? [""];
  const purchasePrice = Number(form.watch("purchasePrice") || 0);
  const sellingPrice = Number(form.watch("sellingPrice") || 0);

  const parentCategories = useMemo(
    () => categories.filter((category) => !category.parentCategory),
    [categories],
  );

  const subcategoryOptions = useMemo(
    () =>
      categories.filter((category) => {
        if (!category.parentCategory) return false;
        const parentId =
          typeof category.parentCategory === "string"
            ? category.parentCategory
            : category.parentCategory._id;
        return parentId === selectedCategory;
      }),
    [categories, selectedCategory],
  );

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initialData?.name ?? "",
      sku: initialData?.sku ?? "",
      barcode: initialData?.barcode ?? "",
      description: initialData?.description ?? "",
      category: idOf(initialData?.category),
      subcategory: idOf(initialData?.subcategory) || null,
      purchasePrice: initialData?.purchasePrice ?? 0,
      sellingPrice: initialData?.sellingPrice ?? 0,
      currentStock: initialData?.currentStock ?? 0,
      minStockLevel: initialData?.minStockLevel ?? 5,
      unit: (initialData?.unit as ProductFormValues["unit"]) ?? "piece",
      hsn: initialData?.hsn ?? "",
      gstRate: initialData?.gstRate ?? 0,
      images:
        initialData?.images && initialData.images.length > 0
          ? initialData.images
          : [""],
      isActive: initialData?.isActive ?? true,
    });
  }, [open, initialData, form]);

  const margin =
    purchasePrice > 0
      ? ((sellingPrice - purchasePrice) / purchasePrice) * 100
      : sellingPrice > 0
        ? 100
        : 0;
  const profit = sellingPrice - purchasePrice;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-lg overflow-y-auto sm:max-w-xl"
      >
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>
            {mode === "create" ? "Add product" : "Edit product"}
          </SheetTitle>
          <SheetDescription>
            Manage pricing, stock levels, and category placement for this item.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-5 p-4 sm:p-6"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit({
              ...values,
              images: (values.images ?? []).filter((url: string) => url.trim()),
            });
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="product-name">Product name</Label>
            <Input
              id="product-name"
              placeholder="e.g. Organic Basmati Rice 5kg"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-sku">SKU</Label>
              <div className="flex gap-2">
                <Input
                  id="product-sku"
                  placeholder="SKU"
                  {...form.register("sku")}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Generate SKU"
                  onClick={() => {
                    const name = form.getValues("name");
                    form.setValue("sku", generateSku(name || "PRODUCT"), {
                      shouldValidate: true,
                    });
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              {form.formState.errors.sku ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sku.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-barcode">Barcode</Label>
              <Input
                id="product-barcode"
                placeholder="Optional"
                {...form.register("barcode")}
              />
              {form.formState.errors.barcode ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.barcode.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description">Description</Label>
            <Textarea
              id="product-description"
              placeholder="Optional product details"
              {...form.register("description")}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Category</Label>
              <Controller
                control={form.control}
                name="category"
                render={({ field }) => (
                  <Select
                    value={field.value || undefined}
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue("subcategory", null);
                    }}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((category) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.category ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.category.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Subcategory</Label>
              <Controller
                control={form.control}
                name="subcategory"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? null : value)
                    }
                    disabled={!selectedCategory || subcategoryOptions.length === 0}
                  >
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Optional" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No subcategory</SelectItem>
                      {subcategoryOptions.map((category) => (
                        <SelectItem key={category._id} value={category._id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchase-price">Purchase price</Label>
              <Input
                id="purchase-price"
                type="number"
                min={0}
                step="0.01"
                {...form.register("purchasePrice")}
              />
              {form.formState.errors.purchasePrice ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.purchasePrice.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="selling-price">Selling price</Label>
              <Input
                id="selling-price"
                type="number"
                min={0}
                step="0.01"
                {...form.register("sellingPrice")}
              />
              {form.formState.errors.sellingPrice ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.sellingPrice.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-hsn">HSN / SAC</Label>
              <Input
                id="product-hsn"
                placeholder="Optional"
                {...form.register("hsn")}
              />
              {form.formState.errors.hsn ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.hsn.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-gst">GST rate %</Label>
              <Input
                id="product-gst"
                type="number"
                min={0}
                max={100}
                step="0.01"
                {...form.register("gstRate")}
              />
              <p className="text-xs text-muted-foreground">
                Used only when the business is GST registered. Leave 0 for exempt items.
              </p>
              {form.formState.errors.gstRate ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.gstRate.message}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-secondary/60 px-4 py-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Profit margin preview</span>
              <span className="font-semibold text-foreground">
                {Number.isFinite(margin) ? `${margin.toFixed(1)}%` : "—"}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Profit per unit: {formatCurrency(profit)}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="current-stock">
                {mode === "edit" ? "Current stock" : "Opening stock"}
              </Label>
              <Input
                id="current-stock"
                type="number"
                min={0}
                step="1"
                readOnly={mode === "edit"}
                disabled={mode === "edit"}
                className={mode === "edit" ? "bg-muted" : undefined}
                {...form.register("currentStock")}
              />
              {mode === "edit" ? (
                <p className="text-xs text-muted-foreground">
                  Use Inventory → Adjust stock to change quantity.
                </p>
              ) : null}
              {form.formState.errors.currentStock ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.currentStock.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="min-stock">Min stock</Label>
              <Input
                id="min-stock"
                type="number"
                min={0}
                step="1"
                {...form.register("minStockLevel")}
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Controller
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCT_UNITS.map((unit) => (
                        <SelectItem key={unit} value={unit}>
                          {unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Image URLs</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("images", [...imageValues, ""], {
                    shouldValidate: true,
                  })
                }
                disabled={imageValues.length >= 8}
              >
                <Plus className="h-4 w-4" />
                Add image
              </Button>
            </div>
            <div className="space-y-2">
              {imageValues.map((_, index) => (
                <div key={`image-${index}`} className="flex gap-2">
                  <Input
                    placeholder="https://…"
                    {...form.register(`images.${index}` as const)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    disabled={imageValues.length <= 1}
                    onClick={() =>
                      form.setValue(
                        "images",
                        imageValues.filter((_, i) => i !== index),
                        { shouldValidate: true },
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive products stay in catalog but are hidden from POS later.
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

          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : mode === "create" ? (
                "Create product"
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
