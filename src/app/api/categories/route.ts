import { Types } from "mongoose";
import {
  escapeRegex,
  handleApiError,
  jsonError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { requireTenant } from "@/lib/tenant";
import {
  assertValidParent,
  ensureUniqueSlug,
} from "@/lib/category-rules";
import { normalizeName, slugify } from "@/lib/slug";
import { categoryCreateSchema } from "@/lib/validators/category";
import { Category } from "@/models/Category";
import { Product } from "@/models/Product";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const status = searchParams.get("status"); // active | inactive | all
    const parentOnly = searchParams.get("parentOnly") === "true";
    const flat = searchParams.get("flat") === "true";

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
    };

    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    if (parentOnly) {
      filter.$or = [
        { parentCategory: null },
        { parentCategory: { $exists: false } },
      ];
    }

    if (search) {
      const searchClause = {
        $or: [
          { name: { $regex: escapeRegex(search), $options: "i" } },
          { description: { $regex: escapeRegex(search), $options: "i" } },
          { slug: { $regex: escapeRegex(search), $options: "i" } },
        ],
      };
      filter.$and = [searchClause];
    }

    if (flat) {
      const categories = await Category.find(filter)
        .select("name slug parentCategory isActive image")
        .sort({ name: 1 })
        .lean();
      return jsonOk({ data: categories });
    }

    const [
      total,
      categories,
      totalCategories,
      activeCategories,
      totalProducts,
    ] = await Promise.all([
      Category.countDocuments(filter),
      Category.find(filter)
        .populate("parentCategory", "name slug")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Category.countDocuments({ businessId: tenant.businessId }),
      Category.countDocuments({
        businessId: tenant.businessId,
        isActive: true,
      }),
      Product.countDocuments({ businessId: tenant.businessId }),
    ]);

    const categoryIds = categories.map((c) => c._id);
    const countDocs =
      categoryIds.length > 0
        ? await Product.aggregate<{ _id: Types.ObjectId; count: number }>([
            {
              $match: {
                businessId: tenant.businessId,
                $or: [
                  { category: { $in: categoryIds } },
                  { subcategory: { $in: categoryIds } },
                ],
              },
            },
            {
              $project: {
                refs: {
                  $setUnion: [
                    ["$category"],
                    {
                      $cond: [
                        { $ifNull: ["$subcategory", false] },
                        ["$subcategory"],
                        [],
                      ],
                    },
                  ],
                },
              },
            },
            { $unwind: "$refs" },
            { $match: { refs: { $in: categoryIds } } },
            { $group: { _id: "$refs", count: { $sum: 1 } } },
          ])
        : [];

    const countMap = new Map(
      countDocs.map((row) => [row._id.toString(), row.count]),
    );

    const data = categories.map((category) => ({
      ...category,
      productCount: countMap.get(category._id.toString()) ?? 0,
    }));

    return jsonOk({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        totalCategories,
        activeCategories,
        totalProducts,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);

    const body = await request.json();
    const parsed = categoryCreateSchema.parse(body);

    const normalizedName = normalizeName(parsed.name);
    const existingName = await Category.exists({
      normalizedName,
      businessId: tenant.businessId,
    });
    if (existingName) {
      return jsonError(
        "A category with this name already exists (case-insensitive).",
        409,
      );
    }

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
      await assertValidParent(null, parsed.parentCategory, tenant.businessId);
    }

    const baseSlug = slugify(parsed.name);
    const slug = await ensureUniqueSlug(baseSlug, {
      businessId: tenant.businessId,
    });

    const category = await Category.create({
      businessId: tenant.businessId,
      name: parsed.name.trim(),
      normalizedName,
      slug,
      description: parsed.description ?? "",
      image: parsed.image ?? "",
      parentCategory: parsed.parentCategory,
      isActive: parsed.isActive ?? true,
    });

    const populated = await Category.findById(category._id)
      .populate("parentCategory", "name slug")
      .lean();

    return jsonOk({ data: populated }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
