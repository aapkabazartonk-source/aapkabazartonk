import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_ADJUSTMENT_TYPES,
  type StockAdjustmentStatus,
  type StockAdjustmentType,
} from "@/lib/constants";

export interface IStockAdjustment {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  adjustmentNumber: string;
  idempotencyKey?: string | null;
  product: Types.ObjectId;
  adjustmentType: StockAdjustmentType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  notes: string;
  referenceNumber: string;
  status: StockAdjustmentStatus;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustment>(
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
      required: true,
    },
    adjustmentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: 80,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    adjustmentType: {
      type: String,
      enum: STOCK_ADJUSTMENT_TYPES,
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0, "Quantity cannot be negative"],
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: [true, "Reason is required"],
      trim: true,
      maxlength: [500, "Reason cannot exceed 500 characters"],
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    referenceNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: [100, "Reference number cannot exceed 100 characters"],
    },
    status: {
      type: String,
      enum: STOCK_ADJUSTMENT_STATUSES,
      default: "COMPLETED",
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

StockAdjustmentSchema.index(
  { businessId: 1, adjustmentNumber: 1 },
  { unique: true },
);
StockAdjustmentSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
StockAdjustmentSchema.index({ businessId: 1, createdAt: -1 });
StockAdjustmentSchema.index({ businessId: 1, product: 1, createdAt: -1 });

export type StockAdjustmentDocument = InferSchemaType<
  typeof StockAdjustmentSchema
> & {
  _id: Types.ObjectId;
};

type StockAdjustmentModel = Model<IStockAdjustment>;

export const StockAdjustment =
  (models.StockAdjustment as StockAdjustmentModel | undefined) ||
  model<IStockAdjustment>("StockAdjustment", StockAdjustmentSchema);
