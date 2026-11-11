import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import { USER_ROLES, type UserRole } from "@/lib/constants";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  phone: string;
  avatarUrl: string;
  isActive: boolean;
  /**
   * Set when authentication is integrated. See src/lib/tenant.ts.
   * Requests must not supply this value.
   */
  businessId?: Types.ObjectId | null;
  defaultStoreId?: Types.ObjectId | null;
  mustChangePassword: boolean;
  lastPasswordChangeAt?: Date | null;
  /** Bumped on password reset / forced logout so sealed sessions stop working. */
  sessionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 120,
    },
    /** scrypt hash — never store plaintext passwords. */
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "owner",
      index: true,
    },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    avatarUrl: { type: String, default: "", trim: true, maxlength: 500 },
    isActive: { type: Boolean, default: true },
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: null,
      index: true,
    },
    defaultStoreId: {
      type: Schema.Types.ObjectId,
      ref: "Store",
      default: null,
    },
    mustChangePassword: { type: Boolean, default: false },
    lastPasswordChangeAt: { type: Date, default: null },
    sessionVersion: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

UserSchema.index({ businessId: 1, role: 1 });

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: Types.ObjectId;
};

type UserModel = Model<IUser>;

export const User =
  (models.User as UserModel | undefined) || model<IUser>("User", UserSchema);
