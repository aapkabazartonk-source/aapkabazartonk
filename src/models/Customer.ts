import { Schema, models, model, type InferSchemaType } from "mongoose";

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true },
    phone: { type: String, required: true },
    address: { type: String },
    notes: { type: String },
    totalSpent: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type CustomerDocument = InferSchemaType<typeof CustomerSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Customer = models.Customer || model("Customer", CustomerSchema);
