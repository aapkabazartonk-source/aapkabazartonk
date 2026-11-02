import { z } from "zod";

const optionalUrl = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^https?:\/\/.+/i.test(value),
    "Enter a valid image URL starting with http:// or https://",
  );

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Category name cannot exceed 100 characters"),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters"),
  image: optionalUrl,
  parentCategory: z.string().trim().nullable(),
  isActive: z.boolean(),
});

export const categoryCreateSchema = categoryFormSchema;
export const categoryUpdateSchema = categoryFormSchema.partial();

export type CategoryFormValues = z.infer<typeof categoryFormSchema>;
