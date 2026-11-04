import { z } from "zod";
import { GSTIN_REGEX, isValidStateCode } from "@/lib/india-states";

export const customerCreateSchema = z
  .object({
    name: z.string().trim().min(1, "Customer name is required").max(120),
    phone: z.string().trim().min(6, "Phone is required").max(20),
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
    gstin: z
      .string()
      .trim()
      .toUpperCase()
      .refine((value) => value === "" || GSTIN_REGEX.test(value), "Enter a valid GSTIN")
      .optional()
      .default(""),
    stateCode: z.string().trim().optional().default(""),
    notes: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((data, ctx) => {
    if (data.stateCode && !isValidStateCode(data.stateCode)) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "Select a valid state code",
      });
    }
    if (data.gstin && data.stateCode && data.gstin.slice(0, 2) !== data.stateCode) {
      ctx.addIssue({
        code: "custom",
        path: ["stateCode"],
        message: "State code must match the first two digits of the GSTIN",
      });
    }
  });

export type CustomerCreateValues = z.infer<typeof customerCreateSchema>;
