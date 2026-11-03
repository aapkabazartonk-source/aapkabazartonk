import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";

/**
 * A business can operate more than one store later.
 * Phase 3 stamps stock movements and purchases with the default store.
 * On-hand quantity still lives on Product.currentStock (one balance per product).
 */
export interface IStore {
  businessId: Types.ObjectId;
  name: string;
  code: string;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StoreSchema = new Schema<IStore>(
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
      maxlength: 200,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

StoreSchema.index({ businessId: 1, code: 1 }, { unique: true });
StoreSchema.index({ businessId: 1, isDefault: 1 });

export type StoreDocument = InferSchemaType<typeof StoreSchema> & {
  _id: Types.ObjectId;
};

type StoreModel = Model<IStore>;

export const Store =
  (models.Store as StoreModel | undefined) || model<IStore>("Store", StoreSchema);
