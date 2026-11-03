import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  PRODUCT_UNITS,
  type ProductUnit,
} from "@/lib/constants";

export { PRODUCT_UNITS, type ProductUnit };

export interface IProduct {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId | null;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category: Types.ObjectId;
  subcategory: Types.ObjectId | null;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockLevel: number;
  unit: ProductUnit;
  images: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    storeId: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      maxlength: [200, "Product name cannot exceed 200 characters"],
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required"],
      min: [0, "Purchase price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },
    currentStock: {
      type: Number,
      required: [true, "Current stock is required"],
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    minStockLevel: {
      type: Number,
      min: [0, "Minimum stock level cannot be negative"],
      default: 5,
    },
    unit: {
      type: String,
      enum: PRODUCT_UNITS,
      default: "piece",
    },
    images: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

ProductSchema.index({ businessId: 1, sku: 1 }, { unique: true });
ProductSchema.index(
  { businessId: 1, barcode: 1 },
  {
    unique: true,
    partialFilterExpression: { barcode: { $type: "string", $gt: "" } },
  },
);
ProductSchema.index({ category: 1, isActive: 1 });
ProductSchema.index({ currentStock: 1, minStockLevel: 1 });
ProductSchema.index({ name: "text", sku: "text", barcode: "text", description: "text" });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ sellingPrice: 1 });

export type ProductDocument = InferSchemaType<typeof ProductSchema> & {
  _id: Types.ObjectId;
};

type ProductModel = Model<IProduct>;

export const Product =
  (models.Product as ProductModel | undefined) ||
  model<IProduct>("Product", ProductSchema);
