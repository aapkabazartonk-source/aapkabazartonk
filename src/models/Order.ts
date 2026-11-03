import { Schema, models, model, type InferSchemaType } from "mongoose";

const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: "Customer" },
    items: { type: [OrderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["completed", "pending", "cancelled", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "credit"],
      default: "cash",
    },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    /** Reserved for Phase 4 sales. Sale movements will reference this order. */
    businessId: { type: Schema.Types.ObjectId, ref: "Business", index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store" },
  },
  { timestamps: true },
);

export type OrderDocument = InferSchemaType<typeof OrderSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Order = models.Order || model("Order", OrderSchema);
