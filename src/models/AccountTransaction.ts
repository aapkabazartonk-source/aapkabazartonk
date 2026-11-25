import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  ACCOUNT_TRANSACTION_REFERENCE_TYPES,
  ACCOUNT_TRANSACTION_TYPES,
  type AccountTransactionReferenceType,
  type AccountTransactionType,
} from "@/lib/constants";

export interface IAccountTransaction {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  accountId: Types.ObjectId;
  transactionNumber: string;
  entryType: AccountTransactionType;
  entryDate: Date;
  description: string;
  /** Increases account balance (money in). */
  debit: number;
  /** Decreases account balance (money out). */
  credit: number;
  referenceType: AccountTransactionReferenceType;
  referenceId?: Types.ObjectId | null;
  referenceNumber: string;
  /** Idempotency key scoped to business — prevents double posts. */
  idempotencyKey: string;
  reversedBy?: Types.ObjectId | null;
  reversesTransactionId?: Types.ObjectId | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AccountTransactionSchema = new Schema<IAccountTransaction>(
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
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "FinancialAccount",
      required: true,
      index: true,
    },
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    entryType: {
      type: String,
      enum: ACCOUNT_TRANSACTION_TYPES,
      required: true,
      index: true,
    },
    entryDate: { type: Date, required: true, index: true },
    description: { type: String, default: "", trim: true, maxlength: 500 },
    debit: { type: Number, required: true, min: 0, default: 0 },
    credit: { type: Number, required: true, min: 0, default: 0 },
    referenceType: {
      type: String,
      enum: ACCOUNT_TRANSACTION_REFERENCE_TYPES,
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    referenceNumber: { type: String, default: "", trim: true },
    idempotencyKey: { type: String, required: true, trim: true },
    reversedBy: { type: Schema.Types.ObjectId, default: null },
    reversesTransactionId: { type: Schema.Types.ObjectId, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

AccountTransactionSchema.index(
  { businessId: 1, transactionNumber: 1 },
  { unique: true },
);
AccountTransactionSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true },
);
AccountTransactionSchema.index({
  businessId: 1,
  accountId: 1,
  entryDate: -1,
  createdAt: -1,
});
AccountTransactionSchema.index({
  businessId: 1,
  entryType: 1,
  entryDate: -1,
});

function rejectMutation() {
  throw new Error("Account transactions are immutable.");
}

AccountTransactionSchema.pre("save", function () {
  if (!this.isNew) rejectMutation();
});

for (const hook of [
  "updateOne",
  "updateMany",
  "findOneAndUpdate",
  "replaceOne",
  "deleteOne",
  "deleteMany",
  "findOneAndDelete",
] as const) {
  AccountTransactionSchema.pre(hook, rejectMutation);
}

export type AccountTransactionDocument = InferSchemaType<
  typeof AccountTransactionSchema
> & { _id: Types.ObjectId };

type AccountTransactionModel = Model<IAccountTransaction>;

export const AccountTransaction =
  (models.AccountTransaction as AccountTransactionModel | undefined) ||
  model<IAccountTransaction>("AccountTransaction", AccountTransactionSchema);
