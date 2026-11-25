import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  SALARY_RECORD_STATUSES,
  type SalaryRecordStatus,
} from "@/lib/constants";

export interface ISalaryRecord {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  staffId: Types.ObjectId;
  staffName: string;
  /** YYYY-MM */
  period: string;
  baseSalary: number;
  bonus: number;
  deductions: number;
  /** Advance applied against this period. */
  advanceAdjusted: number;
  /** Gross liability for the period after bonus/deductions. */
  netPayable: number;
  amountPaid: number;
  balanceDue: number;
  status: SalaryRecordStatus;
  /** Expense recognized once when this record is created. */
  expenseRecognized: boolean;
  notes: string;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SalaryRecordSchema = new Schema<ISalaryRecord>(
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
    staffName: { type: String, required: true, trim: true },
    period: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}$/,
    },
    baseSalary: { type: Number, required: true, min: 0 },
    bonus: { type: Number, required: true, min: 0, default: 0 },
    deductions: { type: Number, required: true, min: 0, default: 0 },
    advanceAdjusted: { type: Number, required: true, min: 0, default: 0 },
    netPayable: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0, default: 0 },
    status: {
      type: String,
      enum: SALARY_RECORD_STATUSES,
      required: true,
      index: true,
    },
    expenseRecognized: { type: Boolean, default: true },
    notes: { type: String, default: "", trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

SalaryRecordSchema.index(
  { businessId: 1, staffId: 1, period: 1 },
  { unique: true },
);
SalaryRecordSchema.index({ businessId: 1, period: 1, status: 1 });

export type SalaryRecordDocument = InferSchemaType<typeof SalaryRecordSchema> & {
  _id: Types.ObjectId;
};

type SalaryRecordModel = Model<ISalaryRecord>;

export const SalaryRecord =
  (models.SalaryRecord as SalaryRecordModel | undefined) ||
  model<ISalaryRecord>("SalaryRecord", SalaryRecordSchema);
