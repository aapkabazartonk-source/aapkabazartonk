import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

/**
 * Tracks unadjusted advance salary per staff.
 * Paying advance reduces cash immediately but is not a P&L salary expense
 * until adjusted against a SalaryRecord.
 */
export interface IStaffAdvance {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  staffId: Types.ObjectId;
  /** Remaining unadjusted advance balance. */
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const StaffAdvanceSchema = new Schema<IStaffAdvance>(
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
    },
    balance: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

StaffAdvanceSchema.index({ businessId: 1, staffId: 1 }, { unique: true });

export type StaffAdvanceDocument = InferSchemaType<typeof StaffAdvanceSchema> & {
  _id: Types.ObjectId;
};

type StaffAdvanceModel = Model<IStaffAdvance>;

export const StaffAdvance =
  (models.StaffAdvance as StaffAdvanceModel | undefined) ||
  model<IStaffAdvance>("StaffAdvance", StaffAdvanceSchema);
