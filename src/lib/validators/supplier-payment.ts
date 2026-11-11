import { z } from "zod";
import { SUPPLIER_PAYMENT_METHODS } from "@/lib/constants";

const objectIdString = z
  .string()
  .trim()
  .min(1, "Required")
  .regex(/^[a-f\d]{24}$/i, "Invalid ID");

const allocationSchema = z.object({
  purchaseId: objectIdString,
  amount: z.coerce.number().min(0.01, "Allocation must be greater than 0"),
});

export const supplierPaymentCreateSchema = z
  .object({
    amount: z.coerce.number().min(0.01, "Payment amount must be greater than 0"),
    paymentMethod: z.enum(SUPPLIER_PAYMENT_METHODS),
    paymentDate: z.coerce.date().optional(),
    referenceNumber: z.string().trim().max(80).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
    /**
     * Explicit allocations. When omitted, remaining unpaid RECEIVED purchases
     * are allocated FIFO up to the payment amount.
     */
    allocatedPurchases: z.array(allocationSchema).optional(),
    /**
     * Required when amount exceeds outstanding payables.
     * Excess becomes an unallocated supplier advance — never silently applied.
     */
    allowAdvance: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    if (data.allocatedPurchases && data.allocatedPurchases.length > 0) {
      const sum = data.allocatedPurchases.reduce((acc, row) => acc + row.amount, 0);
      if (sum - data.amount > 0.001) {
        ctx.addIssue({
          code: "custom",
          path: ["allocatedPurchases"],
          message: "Allocated total cannot exceed the payment amount",
        });
      }
    }
  });

export type SupplierPaymentCreateValues = z.infer<
  typeof supplierPaymentCreateSchema
>;
