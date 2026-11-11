import { z } from "zod";
import { GSTIN_REGEX } from "@/lib/india-states";

export const supplierPhoneSchema = z
  .string()
  .trim()
  .min(7, "Phone number is required")
  .max(30)
  .refine(
    (value) => /^[0-9+\-\s()]{7,30}$/.test(value),
    "Enter a valid phone number",
  );

export const supplierFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Supplier name is required")
    .max(200, "Supplier name cannot exceed 200 characters"),
  contactPerson: z
    .string()
    .trim()
    .max(120, "Contact person cannot exceed 120 characters")
    .optional()
    .default(""),
  phone: supplierPhoneSchema,
  email: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) => value === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
      "Enter a valid email",
    )
    .optional()
    .default(""),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (value) => value === "" || GSTIN_REGEX.test(value),
      "Enter a valid 15-character GSTIN",
    )
    .optional()
    .default(""),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .default(""),
  city: z.string().trim().max(80).optional().default(""),
  state: z.string().trim().max(80).optional().default(""),
  pincode: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || /^[1-9][0-9]{5}$/.test(value),
      "Enter a valid 6-digit pincode",
    )
    .optional()
    .default(""),
  openingBalance: z.coerce.number().min(0, "Opening balance cannot be negative").optional().default(0),
  notes: z.string().trim().max(2000).optional().default(""),
  isActive: z.boolean().optional().default(true),
});

export const supplierCreateSchema = supplierFormSchema;

export const supplierUpdateSchema = supplierFormSchema
  .omit({ openingBalance: true })
  .partial()
  .extend({
    openingBalance: z.coerce.number().min(0).optional(),
  });

export type SupplierFormValues = z.infer<typeof supplierFormSchema>;
export type SupplierCreateValues = z.infer<typeof supplierCreateSchema>;
export type SupplierUpdateValues = z.infer<typeof supplierUpdateSchema>;
