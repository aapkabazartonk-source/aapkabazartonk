import { z } from "zod";
import { PRODUCT_UNITS } from "@/lib/constants";

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value),
    "Enter a valid image URL starting with http:// or https://",
  );

const objectIdString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^[a-f\d]{24}$/i, "Invalid ID");

const productBaseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required")
    .max(200, "Product name cannot exceed 200 characters"),
  sku: z
    .string()
    .trim()
    .min(1, "SKU is required")
    .max(64, "SKU cannot exceed 64 characters")
    .transform((value) => value.toUpperCase()),
  barcode: z.string().trim().max(64, "Barcode cannot exceed 64 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description cannot exceed 2000 characters"),
  category: objectIdString,
  subcategory: z
    .string()
    .trim()
    .nullable()
    .refine(
      (value) => value === null || value === "" || /^[a-f\d]{24}$/i.test(value),
      "Invalid subcategory",
    )
    .transform((value) => (value && value.length > 0 ? value : null)),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
  currentStock: z.coerce.number().min(0, "Stock cannot be negative"),
  minStockLevel: z.coerce
    .number()
    .min(0, "Minimum stock level cannot be negative"),
  unit: z.enum(PRODUCT_UNITS),
  hsn: z
    .string()
    .trim()
    .max(16, "HSN/SAC cannot exceed 16 characters")
    .optional(),
  gstRate: z.coerce
    .number()
    .min(0, "GST rate cannot be negative")
    .max(100, "GST rate cannot exceed 100")
    .optional(),
  images: z.array(optionalUrl).max(8, "You can add up to 8 images"),
  isActive: z.boolean(),
});

function refineCategoryRelation(
  data: { category?: string; subcategory?: string | null },
  ctx: z.RefinementCtx,
) {
  if (data.subcategory && data.category && data.subcategory === data.category) {
    ctx.addIssue({
      code: "custom",
      path: ["subcategory"],
      message: "Subcategory cannot be the same as category",
    });
  }
}

export const productFormSchema = productBaseSchema.superRefine(
  refineCategoryRelation,
);

export const productCreateSchema = productFormSchema;

/** Stock quantity cannot be changed via product update — use inventory adjustments. */
export const productUpdateSchema = productBaseSchema
  .omit({ currentStock: true })
  .partial()
  .superRefine(refineCategoryRelation);

export type ProductFormValues = z.infer<typeof productFormSchema>;
