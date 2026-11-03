import { Types } from "mongoose";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { requireTenant } from "@/lib/tenant";
import {
  assertValidParent,
  ensureUniqueSlug,
} from "@/lib/category-rules";
import { normalizeName, slugify } from "@/lib/slug";
import { categoryUpdateSchema } from "@/lib/validators/category";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid category ID.", 400);
    }

    const category = await Category.findOne({
      _id: id,
      businessId: tenant.businessId,
    })
      .populate("parentCategory", "name slug")
      .lean();

    if (!category) {
      return jsonError("Category not found.", 404);
    }

    const productCount = await Product.countDocuments({
      businessId: tenant.businessId,
      $or: [{ category: id }, { subcategory: id }],
    });

    return jsonOk({ data: { ...category, productCount } });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid category ID.", 400);
    }

    const existing = await Category.findOne({
      _id: id,
      businessId: tenant.businessId,
    });
    if (!existing) {
      return jsonError("Category not found.", 404);
    }

    const body = await request.json();
    const parsed = categoryUpdateSchema.parse(body);

    if (parsed.name !== undefined) {
      const normalizedName = normalizeName(parsed.name);
      const duplicate = await Category.exists({
        normalizedName,
        businessId: tenant.businessId,
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
      existing.slug = await ensureUniqueSlug(slugify(parsed.name), {
        businessId: tenant.businessId,
        excludeId: id,
      });
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
        const parent = await Category.findOne({
          _id: parsed.parentCategory,
          businessId: tenant.businessId,
        })
          .select("_id")
          .lean();
        if (!parent) {
          return jsonError("Parent category not found.", 400);
        }
        await assertValidParent(id, parsed.parentCategory, tenant.businessId);
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

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid category ID.", 400);
    }

    const existing = await Category.findOne({
      _id: id,
      businessId: tenant.businessId,
    })
      .select("_id name")
      .lean();
    if (!existing) {
      return jsonError("Category not found.", 404);
    }

    const [productCount, childCount] = await Promise.all([
      Product.countDocuments({
        businessId: tenant.businessId,
        $or: [{ category: id }, { subcategory: id }],
      }),
      Category.countDocuments({
        businessId: tenant.businessId,
        parentCategory: id,
      }),
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

    await Category.deleteOne({ _id: id, businessId: tenant.businessId });
    return jsonOk({ data: { id }, message: "Category deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
