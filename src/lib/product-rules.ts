import { Types } from "mongoose";
import { Category } from "@/models/Category";
import { InventoryLog } from "@/models/InventoryLog";
import { Order } from "@/models/Order";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { StockAdjustment } from "@/models/StockAdjustment";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export function getStockStatus(
  currentStock: number,
  minStockLevel: number,
): StockStatus {
  if (currentStock <= 0) return "out_of_stock";
  if (currentStock <= minStockLevel) return "low_stock";
  return "in_stock";
}

export async function assertValidCategoryRefs(
  categoryId: string,
  subcategoryId: string | null,
  options: { requireActive?: boolean; businessId: Types.ObjectId },
) {
  const requireActive = options?.requireActive ?? true;

  const category = await Category.findOne({
    _id: categoryId,
    businessId: options.businessId,
  })
    .select("name isActive parentCategory")
    .lean<{
      _id: Types.ObjectId;
      name: string;
      isActive: boolean;
      parentCategory?: Types.ObjectId | null;
    } | null>();

  if (!category) {
    throw new Error("Selected category does not exist.");
  }

  if (requireActive && !category.isActive) {
    throw new Error("Products must belong to an active category.");
  }

  if (!subcategoryId) return { category, subcategory: null };

  const subcategory = await Category.findOne({
    _id: subcategoryId,
    businessId: options.businessId,
  })
    .select("name isActive parentCategory")
    .lean<{
      _id: Types.ObjectId;
      name: string;
      isActive: boolean;
      parentCategory?: Types.ObjectId | null;
    } | null>();

  if (!subcategory) {
    throw new Error("Selected subcategory does not exist.");
  }

  if (
    !subcategory.parentCategory ||
    subcategory.parentCategory.toString() !== categoryId
  ) {
    throw new Error("Subcategory must belong to the selected parent category.");
  }

  return { category, subcategory };
}

export async function productHasTransactionReferences(productId: string) {
  const [orderRef, purchaseRef, logRef, adjustmentRef] = await Promise.all([
    Order.exists({ "items.product": productId }),
    Purchase.exists({ "items.product": productId }),
    InventoryLog.exists({ product: productId }),
    StockAdjustment.exists({ product: productId }),
  ]);
  return Boolean(orderRef || purchaseRef || logRef || adjustmentRef);
}

export async function assertUniqueSku(
  sku: string,
  options: { businessId: Types.ObjectId; excludeId?: string },
) {
  const query: Record<string, unknown> = {
    sku: sku.toUpperCase(),
    businessId: options.businessId,
  };
  if (options.excludeId) query._id = { $ne: options.excludeId };
  const exists = await Product.exists(query);
  if (exists) {
    throw new Error("SKU already exists. Please use a unique SKU.");
  }
}

export async function assertUniqueBarcode(
  barcode: string | undefined | null,
  options: { businessId: Types.ObjectId; excludeId?: string },
) {
  const value = (barcode ?? "").trim();
  if (!value) return;

  const query: Record<string, unknown> = {
    barcode: value,
    businessId: options.businessId,
  };
  if (options.excludeId) query._id = { $ne: options.excludeId };
  const exists = await Product.exists(query);
  if (exists) {
    throw new Error("Barcode already exists. Please use a unique barcode.");
  }
}
