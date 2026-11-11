/**
 * Legacy combined business settings schema (profile + tax).
 * Prefer section schemas in ./settings.ts for new Phase 6 routes.
 */
import { z } from "zod";
import { GSTIN_REGEX, isValidStateCode, stateName } from "@/lib/india-states";

const BUSINESS_TYPE_VALUES = [
  "retail",
  "wholesale",
  "kirana",
  "pharmacy",
  "electronics",
  "other",
] as const;

export const businessSettingsSchema = z
  .object({
    name: z.string().trim().min(1, "Business name is required").max(200),
    legalName: z.string().trim().max(200).optional().default(""),
    ownerName: z.string().trim().max(120).optional().default(""),
    storeName: z.string().trim().min(1, "Store name is required").max(200),
    logoUrl: z
      .string()
      .trim()
      .max(500)
      .refine(
        (value) => value === "" || /^https?:\/\/.+/i.test(value),
        "Enter a valid image URL starting with http:// or https://",
      )
      .optional()
      .default(""),
    phone: z.string().trim().max(20).optional().default(""),
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
    stateCode: z.string().trim().optional().default(""),
    pincode: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || /^[1-9][0-9]{5}$/.test(value),
        "Enter a valid 6-digit pincode",
      )
      .optional()
      .default(""),
    country: z.string().trim().max(80).optional().default("India"),
    businessType: z.enum(BUSINESS_TYPE_VALUES).optional().default("retail"),
    financialYearStartMonth: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .default(4),
    isGstRegistered: z.boolean(),
    pricesIncludeGst: z.boolean(),
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
  })
  .superRefine((data, ctx) => {
    if (data.stateCode && !isValidStateCode(data.stateCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "Select a valid state",
      });
    }
    if (data.isGstRegistered && !data.gstin) {
      ctx.addIssue({
        code: "custom",
        path: ["gstin"],
        message: "GSTIN is required for a GST-registered business",
      });
    }
    if (data.isGstRegistered && !data.stateCode) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "State is required so CGST/SGST and IGST can be applied correctly",
      });
    }
    if (data.gstin && data.stateCode && data.gstin.slice(0, 2) !== data.stateCode) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "State must match the first two digits of the GSTIN",
      });
    }
  })
  .transform((data) => ({
    ...data,
    state: data.stateCode ? stateName(data.stateCode) : "",
  }));

export type BusinessSettingsValues = z.infer<typeof businessSettingsSchema>;
