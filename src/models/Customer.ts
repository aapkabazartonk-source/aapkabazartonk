import { Schema, models, model, type InferSchemaType } from "mongoose";

const CustomerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true },
    phone: { type: String, required: true },
    address: { type: String, default: "", trim: true, maxlength: 300 },
    gstin: { type: String, default: "", trim: true, uppercase: true, maxlength: 15 },
    stateCode: { type: String, default: "", trim: true, maxlength: 2 },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    totalSpent: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true },
    businessId: { type: Schema.Types.ObjectId, ref: "Business", index: true },
  },
  { timestamps: true },
);

export type CustomerDocument = InferSchemaType<typeof CustomerSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Customer = models.Customer || model("Customer", CustomerSchema);
