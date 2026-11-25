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

export interface ISalaryPayment {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  staffId: Types.ObjectId;
  salaryRecordId?: Types.ObjectId | null;
  paymentNumber: string;
  /** REGULAR against a salary period, or ADVANCE before recognition. */
  paymentKind: "REGULAR" | "ADVANCE" | "BONUS";
  amount: number;
  paymentMethod: SalaryPaymentMethod;
  accountId: Types.ObjectId;
  paymentDate: Date;
  notes: string;
  idempotencyKey: string;
  isReversed: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryPaymentSchema = new Schema<ISalaryPayment>(
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
    staffId: {
      type: Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
      index: true,
    },
    salaryRecordId: {
      type: Schema.Types.ObjectId,
      ref: "SalaryRecord",
      default: null,
      index: true,
    },
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    paymentKind: {
      type: String,
      enum: ["REGULAR", "ADVANCE", "BONUS"],
      required: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: SALARY_PAYMENT_METHODS,
      required: true,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "FinancialAccount",
      required: true,
    },
    paymentDate: { type: Date, required: true },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    idempotencyKey: { type: String, required: true, trim: true },
    isReversed: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

SalaryPaymentSchema.index(
  { businessId: 1, paymentNumber: 1 },
  { unique: true },
);
SalaryPaymentSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true },
);

export type SalaryPaymentDocument = InferSchemaType<
  typeof SalaryPaymentSchema
> & { _id: Types.ObjectId };

type SalaryPaymentModel = Model<ISalaryPayment>;

export const SalaryPayment =
  (models.SalaryPayment as SalaryPaymentModel | undefined) ||
  model<ISalaryPayment>("SalaryPayment", SalaryPaymentSchema);
