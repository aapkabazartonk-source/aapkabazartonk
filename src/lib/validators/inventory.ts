import { z } from "zod";
import { STOCK_ADJUSTMENT_TYPES } from "@/lib/constants";

const objectIdString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^[a-f\d]{24}$/i, "Invalid ID");

export const stockAdjustmentCreateSchema = z.object({
  productId: objectIdString,
  adjustmentType: z.enum(STOCK_ADJUSTMENT_TYPES),
  quantity: z.coerce
    .number()
    .finite()
    .min(0, "Quantity cannot be negative"),
  reason: z
    .string()
    .trim()
    .min(1, "Reason is required")
    .max(500, "Reason cannot exceed 500 characters"),
  notes: z
    .string()
    .trim()
    .max(2000, "Notes cannot exceed 2000 characters")
    .optional()
    .default(""),
  referenceNumber: z
    .string()
    .trim()
    .max(100, "Reference number cannot exceed 100 characters")
    .optional()
    .default(""),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key is too short")
    .max(80)
    .optional(),
}).superRefine((data, ctx) => {
  if (data.adjustmentType !== "CORRECTION" && data.quantity <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["quantity"],
      message: "Quantity must be greater than 0",
    });
  }
});

export type StockAdjustmentCreateValues = z.infer<
  typeof stockAdjustmentCreateSchema
>;
