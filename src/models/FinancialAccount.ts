import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  FINANCIAL_ACCOUNT_TYPES,
  TENDER_METHODS,
  type FinancialAccountType,
  type TenderMethod,
} from "@/lib/constants";

export interface IFinancialAccount {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  name: string;
  accountType: FinancialAccountType;
  /** Optional link used to auto-route POS collections. */
  linkedPaymentMethod?: TenderMethod | null;
  openingBalance: number;
  currentBalance: number;
  allowNegative: boolean;
  isDefault: boolean;
  isActive: boolean;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const FinancialAccountSchema = new Schema<IFinancialAccount>(
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
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    accountType: {
      type: String,
      enum: FINANCIAL_ACCOUNT_TYPES,
      required: true,
      index: true,
    },
    linkedPaymentMethod: {
      type: String,
      enum: TENDER_METHODS,
      default: null,
    },
    openingBalance: { type: Number, required: true, default: 0 },
    currentBalance: { type: Number, required: true, default: 0 },
    allowNegative: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

FinancialAccountSchema.index({ businessId: 1, name: 1 }, { unique: true });
FinancialAccountSchema.index({
  businessId: 1,
  linkedPaymentMethod: 1,
  isActive: 1,
});
/** One active default routing account per payment method per business. */
FinancialAccountSchema.index(
  { businessId: 1, linkedPaymentMethod: 1 },
  {
    unique: true,
    partialFilterExpression: {
      linkedPaymentMethod: { $type: "string" },
      isActive: true,
    },
  },
);

export type FinancialAccountDocument = InferSchemaType<
  typeof FinancialAccountSchema
> & { _id: Types.ObjectId };

type FinancialAccountModel = Model<IFinancialAccount>;

export const FinancialAccount =
  (models.FinancialAccount as FinancialAccountModel | undefined) ||
  model<IFinancialAccount>("FinancialAccount", FinancialAccountSchema);
