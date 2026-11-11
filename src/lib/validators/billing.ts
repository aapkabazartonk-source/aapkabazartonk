import { z } from "zod";
import { TENDER_METHODS } from "@/lib/constants";

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

const optionalObjectId = z
  .union([objectId, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const saleLineSchema = z.object({
  productId: objectId,
  quantity: z.coerce
    .number()
    .positive("Quantity must be greater than 0")
    .max(100000)
    .transform((value) => Math.round(value * 1000) / 1000),
  discount: z.coerce.number().min(0).default(0),
});

export const tenderSchema = z.object({
  method: z.enum(TENDER_METHODS),
  amount: z.coerce.number().min(0),
  tenderedAmount: z.coerce.number().min(0).optional(),
  referenceNumber: z.string().trim().max(80).optional().default(""),
});

const walkInOnly = z
  .any()
  .optional()
  .transform(() => null as string | null);

export const quoteSchema = z.object({
  customerId: walkInOnly,
  notes: z.string().trim().max(500).optional().default(""),
  billDiscount: z.coerce.number().min(0).default(0),
  allowCredit: z.boolean().optional().default(false),
  settle: z.boolean().optional().default(false),
  items: z.array(saleLineSchema).min(1).max(100),
  payments: z.array(tenderSchema).max(8).optional().default([]),
});

export const checkoutSchema = quoteSchema.extend({
  idempotencyKey: z.string().trim().min(8).max(80),
  heldCartId: optionalObjectId,
});

export const holdCartSchema = z.object({
  customerId: walkInOnly,
  notes: z.string().trim().max(500).optional().default(""),
  billDiscount: z.coerce.number().min(0).default(0),
  heldCartId: optionalObjectId,
  items: z.array(saleLineSchema).min(1).max(100),
});

export type QuoteValues = z.infer<typeof quoteSchema>;
export type CheckoutValues = z.infer<typeof checkoutSchema>;
export type HoldCartValues = z.infer<typeof holdCartSchema>;
