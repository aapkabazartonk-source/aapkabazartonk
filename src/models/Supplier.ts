import { Schema, models, model, type InferSchemaType } from "mongoose";

const SupplierSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String },
    email: { type: String, lowercase: true },
    phone: { type: String, required: true },
    address: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
    /** Prepared for Phase 6. Purchases may optionally reference this supplier. */
    businessId: { type: Schema.Types.ObjectId, ref: "Business", index: true },
    storeId: { type: Schema.Types.ObjectId, ref: "Store" },
  },
  { timestamps: true },
);

export type SupplierDocument = InferSchemaType<typeof SupplierSchema> & {
  _id: Schema.Types.ObjectId;
};

export const Supplier = models.Supplier || model("Supplier", SupplierSchema);
