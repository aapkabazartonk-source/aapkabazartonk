import { Schema, models, model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["owner", "manager", "cashier", "viewer"],
      default: "owner",
    },
    phone: { type: String },
    avatarUrl: { type: String },
    isActive: { type: Boolean, default: true },
    /**
     * Set when authentication is integrated. See src/lib/tenant.ts.
     * Requests must not supply this value.
     */
    businessId: { type: Schema.Types.ObjectId, ref: "Business", default: null, index: true },
    defaultStoreId: { type: Schema.Types.ObjectId, ref: "Store", default: null },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: Schema.Types.ObjectId;
};

export const User = models.User || model("User", UserSchema);
