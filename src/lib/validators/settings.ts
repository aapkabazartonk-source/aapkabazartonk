import { z } from "zod";
import { GSTIN_REGEX, isValidStateCode, stateName } from "@/lib/india-states";

/**
 * Inline enum tuples for Zod. Importing `as const` arrays from `@/lib/constants`
 * can be undefined during Turbopack circular evaluation (Object.values crash).
 */
const BUSINESS_TYPE_VALUES = [
  "retail",
  "wholesale",
  "kirana",
  "pharmacy",
  "electronics",
  "other",
] as const;
const PAPER_SIZE_VALUES = ["58mm", "80mm", "A4", "6x4"] as const;
const TENDER_METHOD_VALUES = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
] as const;

const optionalHttpUrl = z
  .string()
  .trim()
  .max(500)
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value),
    "Enter a valid image URL starting with http:// or https://",
  );

const documentPrefix = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Prefix is required")
  .max(12)
  .regex(/^[A-Z][A-Z0-9]*$/, "Prefix must start with a letter (A–Z, 0–9 only)");

export const businessProfileSchema = z
  .object({
    name: z.string().trim().min(1, "Business name is required").max(200),
    legalName: z.string().trim().max(200).optional().default(""),
    ownerName: z.string().trim().max(120).optional().default(""),
    storeName: z.string().trim().min(1, "Store name is required").max(200),
    logoUrl: optionalHttpUrl.optional().default(""),
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
    financialYearStartMonth: z.coerce.number().int().min(1).max(12).optional().default(4),
  })
  .superRefine((data, ctx) => {
    if (data.stateCode && !isValidStateCode(data.stateCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "Select a valid state",
      });
    }
  })
  .transform((data) => ({
    ...data,
    state: data.stateCode ? stateName(data.stateCode) : "",
  }));

export const taxSettingsSchema = z
  .object({
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
    stateCode: z.string().trim().optional().default(""),
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
        message: "State is required for CGST/SGST and IGST",
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

export const invoiceSettingsSchema = z
  .object({
    taxInvoicePrefix: documentPrefix.optional().default("INV"),
    billOfSupplyPrefix: documentPrefix.optional().default("BOS"),
    salePrefix: documentPrefix.optional().default("SAL"),
    paperSize: z.enum(PAPER_SIZE_VALUES).optional().default("80mm"),
    showLogo: z.boolean().optional().default(true),
    showGstin: z.boolean().optional().default(true),
    showAddress: z.boolean().optional().default(true),
    footerNote: z.string().trim().max(500).optional().default(""),
    termsAndConditions: z.string().trim().max(2000).optional().default(""),
    thankYouMessage: z
      .string()
      .trim()
      .max(200)
      .optional()
      .default("Thank you for shopping with us!"),
    template: z.literal("standard").optional().default("standard"),
  })
  .superRefine((data, ctx) => {
    const prefixes = [
      data.taxInvoicePrefix,
      data.billOfSupplyPrefix,
      data.salePrefix,
    ];
    if (new Set(prefixes).size !== prefixes.length) {
      ctx.addIssue({
        code: "custom",
        path: ["taxInvoicePrefix"],
        message: "Invoice, bill of supply, and sale prefixes must be unique",
      });
    }
  });

export const printerSettingsSchema = z.object({
  defaultPrinterLabel: z.string().trim().max(120).optional().default("Browser default"),
  paperSize: z.enum(PAPER_SIZE_VALUES).optional().default("80mm"),
  autoPrintAfterBilling: z.boolean().optional().default(false),
  printLogo: z.boolean().optional().default(true),
  printPreview: z.boolean().optional().default(true),
  notes: z.string().trim().max(500).optional().default(""),
});

export const billingSettingsSchema = z
  .object({
    defaultPaymentMethod: z.enum(TENDER_METHOD_VALUES).optional().default("CASH"),
    enabledPaymentMethods: z
      .array(z.enum(TENDER_METHOD_VALUES))
      .min(1, "Enable at least one payment method")
      .optional()
      .default([...TENDER_METHOD_VALUES]),
    enableBillDiscount: z.boolean().optional().default(true),
    maxBillDiscountPercent: z.coerce.number().min(0).max(100).optional().default(100),
    maxBillDiscountAmount: z.coerce.number().min(0).optional().default(0),
    defaultInvoiceTypePreference: z
      .enum(["AUTO", "TAX_INVOICE", "BILL_OF_SUPPLY"])
      .optional()
      .default("AUTO"),
    showStockAvailability: z.boolean().optional().default(true),
    searchIncludesBarcode: z.boolean().optional().default(true),
    searchIncludesSku: z.boolean().optional().default(true),
    requireCheckoutConfirmation: z.boolean().optional().default(true),
    autoPrintAfterBilling: z.boolean().optional().default(false),
    allowCreditSales: z.boolean().optional().default(true),
    keyboardShortcutsEnabled: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    if (!data.enabledPaymentMethods.includes(data.defaultPaymentMethod)) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultPaymentMethod"],
        message: "Default payment method must be enabled",
      });
    }
  });

export const securitySettingsSchema = z.object({
  requirePasswordChangeOnNextLogin: z.boolean().optional().default(false),
  sessionTimeoutMinutes: z.coerce.number().int().min(15).max(10080).optional().default(480),
  currentPassword: z.string().optional(),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .optional(),
  confirmPassword: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.newPassword || data.confirmPassword || data.currentPassword) {
    if (!data.currentPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["currentPassword"],
        message: "Current password is required",
      });
    }
    if (!data.newPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "New password is required",
      });
    }
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Passwords do not match",
      });
    }
  }
});

/** Backward-compatible combined schema used by legacy /api/settings/business PATCH. */
export const businessSettingsSchema = businessProfileSchema
  .and(
    z.object({
      isGstRegistered: z.boolean().optional(),
      pricesIncludeGst: z.boolean().optional(),
      gstin: z.string().optional(),
    }),
  )
  .transform((data) => data);

export type BusinessProfileValues = z.infer<typeof businessProfileSchema>;
export type TaxSettingsValues = z.infer<typeof taxSettingsSchema>;
export type InvoiceSettingsValues = z.infer<typeof invoiceSettingsSchema>;
export type PrinterSettingsValues = z.infer<typeof printerSettingsSchema>;
export type BillingSettingsValues = z.infer<typeof billingSettingsSchema>;
export type SecuritySettingsValues = z.infer<typeof securitySettingsSchema>;
