import { z } from "zod";
import { CUSTOMER_TYPES } from "@/lib/constants";
import { GSTIN_REGEX } from "@/lib/india-states";

export const customerPhoneSchema = z
  .string()
  .trim()
  .min(7, "Mobile number is required")
  .max(30)
  .refine(
    (value) => /^[0-9+\-\s()]{7,30}$/.test(value),
    "Enter a valid mobile number",
  )
  .refine(
    (value) => value.replace(/\D/g, "").length >= 7,
    "Enter a valid mobile number",
  );

export const customerFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(200, "Customer name cannot exceed 200 characters"),
  phone: customerPhoneSchema,
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
  address: z.string().trim().max(300).optional().default(""),
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
  customerType: z.enum(CUSTOMER_TYPES).optional().default("INDIVIDUAL"),
  isActive: z.boolean().optional().default(true),
});

export const customerCreateSchema = customerFormSchema;

export const customerUpdateSchema = customerFormSchema.partial();

export const customerQuickCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Customer name is required")
    .max(200, "Customer name cannot exceed 200 characters"),
  phone: customerPhoneSchema,
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
  customerType: z.enum(CUSTOMER_TYPES).optional().default("INDIVIDUAL"),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;
export type CustomerCreateValues = z.infer<typeof customerCreateSchema>;
export type CustomerUpdateValues = z.infer<typeof customerUpdateSchema>;
export type CustomerQuickCreateValues = z.infer<typeof customerQuickCreateSchema>;
