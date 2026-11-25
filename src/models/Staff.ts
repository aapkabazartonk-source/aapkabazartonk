import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  SALARY_PAYMENT_METHODS,
  type SalaryPaymentMethod,
} from "@/lib/constants";

export interface IStaff {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  name: string;
  phone: string;
  designation: string;
  joiningDate: Date;
  monthlySalary: number;
  paymentPreference: SalaryPaymentMethod;
  isActive: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const StaffSchema = new Schema<IStaff>(
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
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    phone: { type: String, default: "", trim: true, maxlength: 30 },
    designation: { type: String, default: "", trim: true, maxlength: 120 },
    joiningDate: { type: Date, required: true },
    monthlySalary: { type: Number, required: true, min: 0 },
    paymentPreference: {
      type: String,
      enum: SALARY_PAYMENT_METHODS,
      default: "CASH",
    },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

StaffSchema.index({ businessId: 1, name: 1 });
StaffSchema.index({ businessId: 1, isActive: 1, createdAt: -1 });

export type StaffDocument = InferSchemaType<typeof StaffSchema> & {
  _id: Types.ObjectId;
};

type StaffModel = Model<IStaff>;

export const Staff =
  (models.Staff as StaffModel | undefined) ||
  model<IStaff>("Staff", StaffSchema);
