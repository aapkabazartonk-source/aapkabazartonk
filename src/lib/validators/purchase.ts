import { z } from "zod";

const objectIdString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^[a-f\d]{24}$/i, "Invalid ID");

const purchaseItemSchema = z.object({
  productId: objectIdString,
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
  discount: z.coerce.number().min(0).optional().default(0),
});

export const purchaseCreateSchema = z.object({
  supplierName: z
    .string()
    .trim()
    .min(1, "Supplier name is required")
    .max(200),
  supplierContact: z.string().trim().max(200).optional().default(""),
  supplierId: objectIdString.optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one product"),
  discount: z.coerce.number().min(0).optional().default(0),
  tax: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const purchaseUpdateSchema = z.object({
  supplierName: z.string().trim().min(1).max(200).optional(),
  supplierContact: z.string().trim().max(200).optional(),
  supplierId: objectIdString.optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1).optional(),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type PurchaseCreateValues = z.infer<typeof purchaseCreateSchema>;
export type PurchaseUpdateValues = z.infer<typeof purchaseUpdateSchema>;
