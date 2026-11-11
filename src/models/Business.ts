import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import type { BusinessType } from "@/lib/constants";

const BUSINESS_TYPE_VALUES: BusinessType[] = [
  "retail",
  "wholesale",
  "kirana",
  "pharmacy",
  "electronics",
  "other",
];

/**
 * Tenant root. Inventory, purchases, products, and categories belong to a business.
 * Users will point at a business once authentication is integrated (see src/lib/tenant.ts).
 * Nested invoice/printer/billing prefs live on BusinessSettings — not duplicated here.
 */
export interface IBusiness {
  name: string;
  /** Stable key for the single pre-auth workspace. Real signups must not reuse this code. */
  code: string;
  legalName: string;
  ownerName: string;
  logoUrl: string;
  country: string;
  businessType: BusinessType;
  /** Month number 1–12 when the financial year starts (India default April = 4). */
  financialYearStartMonth: number;
  gstin: string;
  isGstRegistered: boolean;
  /** When true, product selling prices already include GST. */
  pricesIncludeGst: boolean;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
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
    ownerName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 120,
    },
    logoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: 500,
    },
    country: {
      type: String,
      default: "India",
      trim: true,
      maxlength: 80,
    },
    businessType: {
      type: String,
      enum: BUSINESS_TYPE_VALUES,
      default: "retail",
    },
    financialYearStartMonth: {
      type: Number,
      default: 4,
      min: 1,
      max: 12,
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
    pricesIncludeGst: {
      type: Boolean,
      default: false,
    },
    phone: { type: String, default: "", trim: true, maxlength: 20 },
    email: { type: String, default: "", trim: true, lowercase: true, maxlength: 120 },
    address: { type: String, default: "", trim: true, maxlength: 300 },
    city: { type: String, default: "", trim: true, maxlength: 80 },
    state: { type: String, default: "", trim: true, maxlength: 80 },
    stateCode: { type: String, default: "", trim: true, maxlength: 2 },
    pincode: { type: String, default: "", trim: true, maxlength: 10 },
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
