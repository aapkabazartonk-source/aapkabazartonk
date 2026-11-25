"use client";

import { useEffect, useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { ApiClientError } from "@/lib/fetch-json";
import {
  categoryFormSchema,
  type CategoryFormValues,
} from "@/lib/validators/category";
import type { CategoryRecord } from "@/types/catalog";

async function uploadCategoryImage(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", file);

  const response = await fetch("/api/uploads/category-image", {
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const imageUrl = form.watch("image");

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

          <div className="space-y-3">
            <div>
              <Label>Category image</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload JPEG, PNG, WebP, or GIF up to 5 MB via Cloudinary.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <button
                type="button"
                className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/50"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || submitting}
                aria-label="Upload category image"
              >
                {imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- Cloudinary delivery URLs are arbitrary hosts.
                  <img
                    src={imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                )}
                {uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 className="h-5 w-5 animate-spin text-foreground" />
                  </div>
                ) : null}
              </button>
              <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  disabled={uploading || submitting}
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;

                    setUploading(true);
                    try {
                      const uploadedUrl = await uploadCategoryImage(file);
                      form.setValue("image", uploadedUrl, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                      toast.success("Image uploaded. Save category to keep it.");
                    } catch (error) {
                      toast.error(
                        error instanceof ApiClientError
                          ? error.message
                          : "Could not upload image.",
                      );
                    } finally {
                      setUploading(false);
                    }
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploading || submitting}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4" />
                        {imageUrl ? "Replace image" : "Upload image"}
                      </>
                    )}
                  </Button>
                  {imageUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploading || submitting}
                      onClick={() =>
                        form.setValue("image", "", {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {form.formState.errors.image ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.image.message}
                  </p>
                ) : null}
              </div>
            </div>
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
              disabled={submitting || uploading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={submitting || uploading}
            >
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
