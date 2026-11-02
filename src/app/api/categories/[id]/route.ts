import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import {
  assertValidParent,
  ensureUniqueSlug,
} from "@/lib/category-rules";
import { normalizeName, slugify } from "@/lib/slug";
import { categoryUpdateSchema } from "@/lib/validators/category";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid category ID.", 400);
    }

    const category = await Category.findById(id)
      .populate("parentCategory", "name slug")
      .lean();

    if (!category) {
      return jsonError("Category not found.", 404);
    }

    const productCount = await Product.countDocuments({
      $or: [{ category: id }, { subcategory: id }],
    });

    return jsonOk({ data: { ...category, productCount } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid category ID.", 400);
    }

    const existing = await Category.findById(id);
    if (!existing) {
      return jsonError("Category not found.", 404);
    }

    const body = await request.json();
    const parsed = categoryUpdateSchema.parse(body);

    if (parsed.name !== undefined) {
      const normalizedName = normalizeName(parsed.name);
      const duplicate = await Category.exists({
        normalizedName,
        _id: { $ne: id },
      });
      if (duplicate) {
        return jsonError(
          "A category with this name already exists (case-insensitive).",
          409,
        );
      }
      existing.name = parsed.name.trim();
      existing.normalizedName = normalizedName;
      existing.slug = await ensureUniqueSlug(slugify(parsed.name), id);
    }

    if (parsed.description !== undefined) {
      existing.description = parsed.description;
    }
    if (parsed.image !== undefined) {
      existing.image = parsed.image;
    }
    if (parsed.isActive !== undefined) {
      existing.isActive = parsed.isActive;
    }

    if (parsed.parentCategory !== undefined) {
      if (parsed.parentCategory) {
        if (!Types.ObjectId.isValid(parsed.parentCategory)) {
          return jsonError("Invalid parent category.", 400);
        }
        const parent = await Category.findById(parsed.parentCategory)
          .select("_id")
          .lean();
        if (!parent) {
          return jsonError("Parent category not found.", 400);
        }
        await assertValidParent(id, parsed.parentCategory);
        existing.parentCategory = new Types.ObjectId(parsed.parentCategory);
      } else {
        existing.parentCategory = null;
      }
    }

    await existing.save();

    const populated = await Category.findById(id)
      .populate("parentCategory", "name slug")
      .lean();

    return jsonOk({ data: populated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await connectToDatabase();
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid category ID.", 400);
    }

    const existing = await Category.findById(id).select("_id name").lean();
    if (!existing) {
      return jsonError("Category not found.", 404);
    }

    const [productCount, childCount] = await Promise.all([
      Product.countDocuments({
        $or: [{ category: id }, { subcategory: id }],
      }),
      Category.countDocuments({ parentCategory: id }),
    ]);

    if (productCount > 0) {
      return jsonError(
        `Cannot delete "${existing.name}" because it contains ${productCount} product${productCount === 1 ? "" : "s"}. Move or delete those products first.`,
        409,
      );
    }

    if (childCount > 0) {
      return jsonError(
        `Cannot delete "${existing.name}" because it has ${childCount} subcategor${childCount === 1 ? "y" : "ies"}. Reassign or delete them first.`,
        409,
      );
    }

    await Category.findByIdAndDelete(id);
    return jsonOk({ data: { id }, message: "Category deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
