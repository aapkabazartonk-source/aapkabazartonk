import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

export interface ICategory {
  businessId: Types.ObjectId;
  name: string;
  normalizedName: string;
  slug: string;
  description: string;
  image: string;
  parentCategory: Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [100, "Category name cannot exceed 100 characters"],
    },
    normalizedName: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    image: {
      type: String,
      default: "",
      trim: true,
    },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

CategorySchema.index({ businessId: 1, normalizedName: 1 }, { unique: true });
CategorySchema.index({ businessId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ parentCategory: 1, isActive: 1 });

export type CategoryDocument = InferSchemaType<typeof CategorySchema> & {
  _id: Types.ObjectId;
};

type CategoryModel = Model<ICategory>;

export const Category =
  (models.Category as CategoryModel | undefined) ||
  model<ICategory>("Category", CategorySchema);
