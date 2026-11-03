import { Types } from "mongoose";
import { Category } from "@/models/Category";

/**
 * Walks parent links to ensure `candidateParentId` is not the category itself
 * and is not a descendant of `categoryId` (which would create a cycle).
 */
export async function assertValidParent(
  categoryId: string | null,
  candidateParentId: string | null,
  businessId: Types.ObjectId,
) {
  if (!candidateParentId) return;

  if (categoryId && candidateParentId === categoryId) {
    throw new Error("A category cannot be its own parent.");
  }

  if (categoryId) {
    let current: string | null = candidateParentId;
    const visited = new Set<string>();

    while (current) {
      if (current === categoryId) {
        throw new Error(
          "This parent would create a circular category relationship.",
        );
      }
      if (visited.has(current)) break;
      visited.add(current);

      const parentDoc: { parentCategory?: Types.ObjectId | null } | null =
        await Category.findOne({ _id: current, businessId })
          .select("parentCategory")
          .lean();

      if (!parentDoc) {
        throw new Error("Parent category not found.");
      }

      current = parentDoc?.parentCategory
        ? parentDoc.parentCategory.toString()
        : null;
    }
  }
}

export async function ensureUniqueSlug(
  baseSlug: string,
  options: { businessId: Types.ObjectId; excludeId?: string },
): Promise<string> {
  let slug = baseSlug || "category";
  let attempt = 0;

  while (attempt < 50) {
    const query: Record<string, unknown> = {
      slug,
      businessId: options.businessId,
    };
    if (options.excludeId) {
      query._id = { $ne: options.excludeId };
    }
    const existing = await Category.exists(query);
    if (!existing) return slug;
    attempt += 1;
    slug = `${baseSlug}-${attempt + 1}`;
  }

  return `${baseSlug}-${Date.now().toString(36)}`;
}
