import { z } from "zod";

const objectIdString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^[a-f\d]{24}$/i, "Invalid ID");

const supplierPhone = z
  .string()
  .trim()
  .max(30)
  .refine(
    (value) => value === "" || /^[0-9+\-\s()]{7,30}$/.test(value),
    "Enter a valid supplier phone number",
  );

const purchaseItemSchema = z.object({
  productId: objectIdString,
  quantity: z.coerce
    .number()
    .min(0.001, "Quantity must be greater than 0"),
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
  supplierContact: supplierPhone.optional().default(""),
  supplierInvoiceNumber: z.string().trim().max(100).optional().default(""),
  supplierId: objectIdString.optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1, "Add at least one product"),
  discount: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().max(2000).optional().default(""),
});

export const purchaseUpdateSchema = z.object({
  supplierName: z.string().trim().min(1).max(200).optional(),
  supplierContact: supplierPhone.optional(),
  supplierInvoiceNumber: z.string().trim().max(100).optional(),
  supplierId: objectIdString.optional().nullable(),
  purchaseDate: z.coerce.date().optional(),
  expectedDeliveryDate: z.coerce.date().optional().nullable(),
  items: z.array(purchaseItemSchema).min(1).optional(),
  discount: z.coerce.number().min(0).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export type PurchaseCreateValues = z.infer<typeof purchaseCreateSchema>;
export type PurchaseUpdateValues = z.infer<typeof purchaseUpdateSchema>;
