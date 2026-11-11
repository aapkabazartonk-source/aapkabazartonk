import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

export interface ISupplier {
  businessId: Types.ObjectId;
  storeId?: Types.ObjectId | null;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  /**
   * Initial payable to supplier at onboarding.
   * Positive = we owe the supplier. Only editable with no purchase/payment history.
   */
  openingBalance: number;
  /**
   * Denormalized payable cache, reconciled against ledger:
   * openingBalance + received purchases − payments (including advances).
   * Positive = payable to supplier.
   */
  currentBalance: number;
  notes: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSchema = new Schema<ISupplier>(
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
    },
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      maxlength: [200, "Supplier name cannot exceed 200 characters"],
    },
    contactPerson: {
      type: String,
      default: "",
      trim: true,
      maxlength: [120, "Contact person cannot exceed 120 characters"],
    },
    phone: {
      type: String,
      required: [true, "Supplier phone is required"],
      trim: true,
      maxlength: [30, "Phone cannot exceed 30 characters"],
    },
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      maxlength: [120, "Email cannot exceed 120 characters"],
    },
    gstin: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: [15, "GSTIN cannot exceed 15 characters"],
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
    pincode: {
      type: String,
      default: "",
      trim: true,
      maxlength: [10, "Pincode cannot exceed 10 characters"],
    },
    openingBalance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Opening balance cannot be negative"],
    },
    currentBalance: {
      type: Number,
      required: true,
      default: 0,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

SupplierSchema.index({ businessId: 1, name: 1 });
SupplierSchema.index({ businessId: 1, phone: 1 });
SupplierSchema.index({ businessId: 1, gstin: 1 });
SupplierSchema.index({ businessId: 1, isActive: 1, createdAt: -1 });
SupplierSchema.index({ businessId: 1, currentBalance: -1 });

export type SupplierDocument = InferSchemaType<typeof SupplierSchema> & {
  _id: Types.ObjectId;
};

type SupplierModel = Model<ISupplier>;

export const Supplier =
  (models.Supplier as SupplierModel | undefined) ||
  model<ISupplier>("Supplier", SupplierSchema);
