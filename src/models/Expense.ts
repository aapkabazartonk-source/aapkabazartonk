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
  EXPENSE_PAYMENT_STATUSES,
  type ExpensePaymentMethod,
  type ExpensePaymentStatus,
} from "@/lib/constants";

export interface IExpense {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  expenseNumber: string;
  title: string;
  categoryId: Types.ObjectId;
  categoryName: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
  expenseDate: Date;
  paymentDate?: Date | null;
  paymentMethod?: ExpensePaymentMethod | null;
  accountId?: Types.ObjectId | null;
  paymentStatus: ExpensePaymentStatus;
  notes: string;
  attachmentUrl: string;
  isReversed: boolean;
  reversedAt?: Date | null;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
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
    expenseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: true,
      index: true,
    },
    categoryName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0, default: 0 },
    expenseDate: { type: Date, required: true, index: true },
    paymentDate: { type: Date, default: null },
    paymentMethod: {
      type: String,
      enum: [...EXPENSE_PAYMENT_METHODS, null],
      default: null,
    },
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "FinancialAccount",
      default: null,
    },
    paymentStatus: {
      type: String,
      enum: EXPENSE_PAYMENT_STATUSES,
      required: true,
      index: true,
    },
    notes: { type: String, default: "", trim: true, maxlength: 2000 },
    attachmentUrl: { type: String, default: "", trim: true },
    isReversed: { type: Boolean, default: false, index: true },
    reversedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

ExpenseSchema.index({ businessId: 1, expenseNumber: 1 }, { unique: true });
ExpenseSchema.index({
  businessId: 1,
  expenseDate: -1,
  createdAt: -1,
});
ExpenseSchema.index({ businessId: 1, paymentStatus: 1, expenseDate: -1 });
ExpenseSchema.index({ businessId: 1, categoryId: 1, expenseDate: -1 });

export type ExpenseDocument = InferSchemaType<typeof ExpenseSchema> & {
  _id: Types.ObjectId;
};

type ExpenseModel = Model<IExpense>;

export const Expense =
  (models.Expense as ExpenseModel | undefined) ||
  model<IExpense>("Expense", ExpenseSchema);
