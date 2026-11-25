import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

export interface IExpenseCategory {
  businessId: Types.ObjectId;
  name: string;
  normalizedName: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

ExpenseCategorySchema.index(
  { businessId: 1, normalizedName: 1 },
  { unique: true },
);
ExpenseCategorySchema.index({ businessId: 1, isActive: 1, name: 1 });

export type ExpenseCategoryDocument = InferSchemaType<
  typeof ExpenseCategorySchema
> & { _id: Types.ObjectId };

type ExpenseCategoryModel = Model<IExpenseCategory>;

export const ExpenseCategory =
  (models.ExpenseCategory as ExpenseCategoryModel | undefined) ||
  model<IExpenseCategory>("ExpenseCategory", ExpenseCategorySchema);
