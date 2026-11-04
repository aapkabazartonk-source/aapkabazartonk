import { Types } from "mongoose";
import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { requireTenant } from "@/lib/tenant";
import {
  assertUniqueBarcode,
  assertUniqueSku,
  assertValidCategoryRefs,
  getStockStatus,
  productHasTransactionReferences,
} from "@/lib/product-rules";
import { productUpdateSchema } from "@/lib/validators/product";
import { Product } from "@/models/Product";

type RouteContext = { params: Promise<{ id: string }> };

function serializeProduct(product: Record<string, unknown>) {
  const currentStock = Number(product.currentStock ?? 0);
  const minStockLevel = Number(product.minStockLevel ?? 0);
  return {
    ...product,
    stockStatus: getStockStatus(currentStock, minStockLevel),
  };
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid product ID.", 400);
    }

    const product = await Product.findOne({
      _id: id,
      businessId: tenant.businessId,
    })
      .populate("category", "name slug isActive")
      .populate("subcategory", "name slug")
      .lean();

    if (!product) {
      return jsonError("Product not found.", 404);
    }

    return jsonOk({
      data: serializeProduct(product as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid product ID.", 400);
    }

    const existing = await Product.findOne({
      _id: id,
      businessId: tenant.businessId,
    });
    if (!existing) {
      return jsonError("Product not found.", 404);
    }

    const body = await request.json();
    if (
      body &&
      typeof body === "object" &&
      "currentStock" in body &&
      (body as { currentStock?: unknown }).currentStock !== undefined
    ) {
      return jsonError(
        "Stock cannot be modified through product updates. Use inventory adjustments instead.",
        400,
      );
    }
    const parsed = productUpdateSchema.parse(body);

    const nextCategory =
      parsed.category !== undefined
        ? parsed.category
        : existing.category.toString();
    const nextSubcategory =
      parsed.subcategory !== undefined
        ? parsed.subcategory
        : existing.subcategory
          ? existing.subcategory.toString()
          : null;

    if (parsed.category !== undefined || parsed.subcategory !== undefined) {
      await assertValidCategoryRefs(nextCategory, nextSubcategory, {
        requireActive: true,
        businessId: tenant.businessId,
      });
    }

    if (parsed.sku !== undefined) {
      await assertUniqueSku(parsed.sku, {
        businessId: tenant.businessId,
        excludeId: id,
      });
      existing.sku = parsed.sku;
    }

    if (parsed.barcode !== undefined) {
      await assertUniqueBarcode(parsed.barcode, {
        businessId: tenant.businessId,
        excludeId: id,
      });
      existing.barcode = parsed.barcode.trim();
    }

    if (parsed.name !== undefined) existing.name = parsed.name.trim();
    if (parsed.description !== undefined) {
      existing.description = parsed.description;
    }
    if (parsed.category !== undefined) {
      existing.category = new Types.ObjectId(parsed.category);
    }
    if (parsed.subcategory !== undefined) {
      existing.subcategory = parsed.subcategory
        ? new Types.ObjectId(parsed.subcategory)
        : null;
    }
    if (parsed.purchasePrice !== undefined) {
      existing.purchasePrice = parsed.purchasePrice;
    }
    if (parsed.sellingPrice !== undefined) {
      existing.sellingPrice = parsed.sellingPrice;
    }
    if (parsed.minStockLevel !== undefined) {
      existing.minStockLevel = parsed.minStockLevel;
    }
    if (parsed.unit !== undefined) existing.unit = parsed.unit;
    if (parsed.hsn !== undefined) existing.hsn = parsed.hsn.trim().toUpperCase();
    if (parsed.gstRate !== undefined) existing.gstRate = parsed.gstRate;
    if (parsed.images !== undefined) {
      existing.images = parsed.images.filter((url) => url.trim().length > 0);
    }
    if (parsed.isActive !== undefined) existing.isActive = parsed.isActive;

    await existing.save();

    const populated = await Product.findById(id)
      .populate("category", "name slug isActive")
      .populate("subcategory", "name slug")
      .lean();

    return jsonOk({
      data: serializeProduct(populated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid product ID.", 400);
    }

    const existing = await Product.findOne({
      _id: id,
      businessId: tenant.businessId,
    })
      .select("_id name")
      .lean();
    if (!existing) {
      return jsonError("Product not found.", 404);
    }

    const hasRefs = await productHasTransactionReferences(id);
    if (hasRefs) {
      return jsonError(
        `Cannot delete "${existing.name}" because it has existing sales, purchase, or inventory references. Archive the product instead.`,
        409,
      );
    }

    await Product.deleteOne({ _id: id, businessId: tenant.businessId });
    return jsonOk({ data: { id }, message: "Product deleted successfully." });
  } catch (error) {
    return handleApiError(error);
  }
}
