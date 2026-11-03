import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

/**
 * Tenant root. Inventory, purchases, products, and categories belong to a business.
 * Users will point at a business once authentication is integrated (see src/lib/tenant.ts).
 */
export interface IBusiness {
  name: string;
  /** Stable key for the single pre-auth workspace. Real signups must not reuse this code. */
  code: string;
  legalName: string;
  gstin: string;
  isGstRegistered: boolean;
  /**
   * Suggested reorder target = minStockLevel * reorderMultiple.
   * See src/lib/reorder.ts.
   */
  reorderMultiple: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const BusinessSchema = new Schema<IBusiness>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    legalName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 200,
    },
    gstin: {
      type: String,
      default: "",
      trim: true,
      uppercase: true,
      maxlength: 15,
    },
    isGstRegistered: {
      type: Boolean,
      default: false,
    },
    reorderMultiple: {
      type: Number,
      default: 2,
      min: [1, "Reorder multiple must be at least 1"],
      max: [20, "Reorder multiple cannot exceed 20"],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true },
);

BusinessSchema.index({ code: 1 }, { unique: true });

export type BusinessDocument = InferSchemaType<typeof BusinessSchema> & {
  _id: Types.ObjectId;
};

type BusinessModel = Model<IBusiness>;

export const Business =
  (models.Business as BusinessModel | undefined) ||
  model<IBusiness>("Business", BusinessSchema);
