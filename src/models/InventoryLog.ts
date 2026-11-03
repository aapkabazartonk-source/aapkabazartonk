import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  INVENTORY_MOVEMENT_TYPES,
  INVENTORY_REFERENCE_TYPES,
  type InventoryMovementType,
  type InventoryReferenceType,
} from "@/lib/constants";

export interface IInventoryLog {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  product: Types.ObjectId;
  movementType: InventoryMovementType;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  referenceType: InventoryReferenceType;
  referenceId?: Types.ObjectId | null;
  referenceNumber: string;
  notes?: string;
  performedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryLogSchema = new Schema<IInventoryLog>(
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
      index: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    movementType: {
      type: String,
      enum: INVENTORY_MOVEMENT_TYPES,
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
    referenceType: {
      type: String,
      enum: INVENTORY_REFERENCE_TYPES,
      required: true,
      index: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    referenceNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 100,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

InventoryLogSchema.index({ businessId: 1, createdAt: -1 });
InventoryLogSchema.index({ businessId: 1, product: 1, createdAt: -1 });
InventoryLogSchema.index({ businessId: 1, movementType: 1, createdAt: -1 });
InventoryLogSchema.index({ businessId: 1, referenceType: 1, referenceId: 1 });

function rejectInventoryLogMutation() {
  throw new Error(
    "Inventory logs are immutable and cannot be modified through application APIs.",
  );
}

const immutableHooks = [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const;

for (const hook of immutableHooks) {
  InventoryLogSchema.pre(hook, rejectInventoryLogMutation);
}

export type InventoryLogDocument = InferSchemaType<typeof InventoryLogSchema> & {
  _id: Types.ObjectId;
};

type InventoryLogModel = Model<IInventoryLog>;

export const InventoryLog =
  (models.InventoryLog as InventoryLogModel | undefined) ||
  model<IInventoryLog>("InventoryLog", InventoryLogSchema);
