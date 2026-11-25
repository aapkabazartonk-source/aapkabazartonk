import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  EXPENSE_PAYMENT_METHODS,
  type ExpensePaymentMethod,
} from "@/lib/constants";

export interface IExpensePayment {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  expenseId: Types.ObjectId;
  paymentNumber: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  accountId: Types.ObjectId;
  paymentDate: Date;
  notes: string;
  idempotencyKey: string;
  isReversed: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExpensePaymentSchema = new Schema<IExpensePayment>(
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
    expenseId: {
      type: Schema.Types.ObjectId,
      ref: "Expense",
      required: true,
      index: true,
    },
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: EXPENSE_PAYMENT_METHODS,
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

ExpensePaymentSchema.index(
  { businessId: 1, paymentNumber: 1 },
  { unique: true },
);
ExpensePaymentSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  { unique: true },
);

export type ExpensePaymentDocument = InferSchemaType<
  typeof ExpensePaymentSchema
> & { _id: Types.ObjectId };

type ExpensePaymentModel = Model<IExpensePayment>;

export const ExpensePayment =
  (models.ExpensePayment as ExpensePaymentModel | undefined) ||
  model<IExpensePayment>("ExpensePayment", ExpensePaymentSchema);
