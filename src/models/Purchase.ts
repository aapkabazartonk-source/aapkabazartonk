import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  PURCHASE_STATUSES,
  type PurchaseStatus,
} from "@/lib/constants";

export interface IPurchaseItem {
  product: Types.ObjectId;
  productName: string;
  sku: string;
  quantity: number;
  purchasePrice: number;
  taxRate: number;
  discount: number;
  total: number;
}

export interface IPurchase {
  purchaseNumber: string;
  supplierName: string;
  supplierContact: string;
  /** Reserved for Phase 4+ supplier directory linkage */
  supplier?: Types.ObjectId | null;
  purchaseDate: Date;
  expectedDeliveryDate?: Date | null;
  items: IPurchaseItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  status: PurchaseStatus;
  notes: string;
  createdBy?: Types.ObjectId | null;
  receivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PurchaseItemSchema = new Schema<IPurchaseItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },
    purchasePrice: {
      type: Number,
      required: true,
      min: [0, "Purchase price cannot be negative"],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const PurchaseSchema = new Schema<IPurchase>(
  {
    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    supplierName: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      maxlength: [200, "Supplier name cannot exceed 200 characters"],
    },
    supplierContact: {
      type: String,
      default: "",
      trim: true,
      maxlength: [200, "Supplier contact cannot exceed 200 characters"],
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      default: null,
      index: true,
    },
    purchaseDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
      validate: {
        validator: (items: IPurchaseItem[]) => Array.isArray(items) && items.length > 0,
        message: "Purchase must include at least one item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: PURCHASE_STATUSES,
      default: "DRAFT",
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

PurchaseSchema.index({ purchaseNumber: 1 }, { unique: true });
PurchaseSchema.index({ createdAt: -1 });
PurchaseSchema.index({ status: 1, purchaseDate: -1 });
PurchaseSchema.index({ supplierName: 1 });

export type PurchaseDocument = InferSchemaType<typeof PurchaseSchema> & {
  _id: Types.ObjectId;
};

type PurchaseModel = Model<IPurchase>;

export const Purchase =
  (models.Purchase as PurchaseModel | undefined) ||
  model<IPurchase>("Purchase", PurchaseSchema);
