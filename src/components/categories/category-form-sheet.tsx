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
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/lib/validators/category";
import type { CategoryRecord } from "@/types/catalog";

interface ParentOption {
  _id: string;
  name: string;
}

interface CategoryFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: CategoryRecord | null;
  parentOptions: ParentOption[];
  submitting: boolean;
  onSubmit: (values: CategoryFormValues) => Promise<void>;
}

function parentIdOf(category?: CategoryRecord | null) {
  if (!category?.parentCategory) return null;
  if (typeof category.parentCategory === "string") return category.parentCategory;
  return category.parentCategory._id;
}

export function CategoryFormSheet({
  open,
  onOpenChange,
  mode,
  initialData,
  parentOptions,
  submitting,
  onSubmit,
}: CategoryFormSheetProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema) as never,
    defaultValues: {
      name: "",
      description: "",
      image: "",
      parentCategory: null,
      isActive: true,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: initialData?.name ?? "",
      description: initialData?.description ?? "",
      image: initialData?.image ?? "",
      parentCategory: parentIdOf(initialData),
      isActive: initialData?.isActive ?? true,
    });
  }, [open, initialData, form]);

  const availableParents = parentOptions.filter(
    (option) => option._id !== initialData?._id,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full max-w-md overflow-y-auto sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border pb-4">
          <SheetTitle>
            {mode === "create" ? "Add category" : "Edit category"}
          </SheetTitle>
          <SheetDescription>
            Organize your catalog with clear, nested product categories.
          </SheetDescription>
        </SheetHeader>

        <form
          className="flex flex-col gap-5 p-4 sm:p-6"
          onSubmit={form.handleSubmit(async (values) => {
            await onSubmit(values);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="category-name">Category name</Label>
            <Input
              id="category-name"
              placeholder="e.g. Fresh Produce"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-description">Description</Label>
            <Textarea
              id="category-description"
              placeholder="Short description for this category"
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-image">Category image URL</Label>
            <Input
              id="category-image"
              placeholder="https://…"
              {...form.register("image")}
            />
            {form.formState.errors.image ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.image.message}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label>Parent category</Label>
            <Controller
              control={form.control}
              name="parentCategory"
              render={({ field }) => (
                <Select
                  value={field.value ?? "none"}
                  onValueChange={(value) =>
                    field.onChange(value === "none" ? null : value)
                  }
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="No parent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {availableParents.map((option) => (
                      <SelectItem key={option._id} value={option._id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {form.formState.errors.parentCategory ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.parentCategory.message}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">Active</p>
              <p className="text-xs text-muted-foreground">
                Inactive categories are hidden from product forms.
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
                "Create category"
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
