import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  CUSTOMER_TYPES,
  type CustomerType,
} from "@/lib/constants";

export interface ICustomer {
  businessId: Types.ObjectId;
  storeId?: Types.ObjectId | null;
  name: string;
  phone: string;
  /** Digits-only phone used for store-scoped uniqueness. */
  phoneNormalized: string;
  email: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  gstin: string;
  customerType: CustomerType;
  notes: string;
  /**
   * Denormalized counters updated on checkout. Prefer live sale aggregations
   * for customer-facing purchase statistics.
   */
  totalSpent: number;
  orderCount: number;
  isActive: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomer>(
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
      default: null,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      maxlength: [200, "Customer name cannot exceed 200 characters"],
    },
    phone: {
      type: String,
      required: [true, "Customer phone is required"],
      trim: true,
      maxlength: [30, "Phone cannot exceed 30 characters"],
    },
    phoneNormalized: {
      type: String,
      required: true,
      trim: true,
      maxlength: [30, "Normalized phone cannot exceed 30 characters"],
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: [120, "Email cannot exceed 120 characters"],
    },
    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Address cannot exceed 300 characters"],
    },
    city: {
      type: String,
      default: "",
      trim: true,
      maxlength: [80, "City cannot exceed 80 characters"],
    },
    state: {
      type: String,
      default: "",
      trim: true,
      maxlength: [80, "State cannot exceed 80 characters"],
    },
    stateCode: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2, "State code cannot exceed 2 characters"],
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
      maxlength: [10, "Pincode cannot exceed 10 characters"],
    },
    gstin: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: [15, "GSTIN cannot exceed 15 characters"],
    },
    customerType: {
      type: String,
      enum: CUSTOMER_TYPES,
      required: true,
      default: "INDIVIDUAL",
      index: true,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
    },
    totalSpent: { type: Number, default: 0, min: 0 },
    orderCount: { type: Number, default: 0, min: 0 },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

CustomerSchema.pre("validate", function normalizePhoneField(this: ICustomer) {
  const phone = (this.phone ?? "").trim();
  this.phone = phone;
  this.phoneNormalized = phone.replace(/\D/g, "");
});

CustomerSchema.index(
  { businessId: 1, phoneNormalized: 1 },
  {
    unique: true,
    partialFilterExpression: { isActive: true },
  },
);
CustomerSchema.index({ businessId: 1, name: 1 });
CustomerSchema.index({ businessId: 1, phone: 1 });
CustomerSchema.index({ businessId: 1, email: 1 });
CustomerSchema.index({ businessId: 1, isActive: 1, createdAt: -1 });
CustomerSchema.index({ businessId: 1, storeId: 1, phoneNormalized: 1 });
CustomerSchema.index({ businessId: 1, customerType: 1, createdAt: -1 });

export type CustomerDocument = InferSchemaType<typeof CustomerSchema> & {
  _id: Types.ObjectId;
};

type CustomerModel = Model<ICustomer>;

export const Customer =
  (models.Customer as CustomerModel | undefined) ||
  model<ICustomer>("Customer", CustomerSchema);
