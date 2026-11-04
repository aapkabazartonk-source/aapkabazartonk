import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { HELD_CART_STATUSES, type HeldCartStatus } from "@/lib/constants";

export interface IHeldCartItem {
  product: Types.ObjectId;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  discount: number;
}

export interface IHeldCart {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  holdNumber: string;
  cartItems: IHeldCartItem[];
  customer?: Types.ObjectId | null;
  billDiscount: number;
  notes: string;
  status: HeldCartStatus;
  sale?: Types.ObjectId | null;
  resumedAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const HeldCartItemSchema = new Schema<IHeldCartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    barcode: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    discount: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false },
);

const HeldCartSchema = new Schema<IHeldCart>(
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
    holdNumber: { type: String, required: true, trim: true, uppercase: true },
    cartItems: {
      type: [HeldCartItemSchema],
      required: true,
      validate: {
        validator: (items: IHeldCartItem[]) =>
          Array.isArray(items) && items.length > 0,
        message: "Held bill must include at least one item",
      },
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },
    billDiscount: { type: Number, required: true, min: 0, default: 0 },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: HELD_CART_STATUSES,
      required: true,
      default: "HELD",
      index: true,
    },
    sale: { type: Schema.Types.ObjectId, ref: "Sale", default: null },
    resumedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

HeldCartSchema.index({ businessId: 1, holdNumber: 1 }, { unique: true });
HeldCartSchema.index({ businessId: 1, status: 1, createdAt: -1 });

export type HeldCartDocument = InferSchemaType<typeof HeldCartSchema> & {
  _id: Types.ObjectId;
};

type HeldCartModel = Model<IHeldCart>;

export const HeldCart =
  (models.HeldCart as HeldCartModel | undefined) ||
  model<IHeldCart>("HeldCart", HeldCartSchema);
