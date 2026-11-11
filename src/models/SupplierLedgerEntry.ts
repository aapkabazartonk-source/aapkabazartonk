import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  SUPPLIER_LEDGER_ENTRY_TYPES,
  SUPPLIER_LEDGER_REFERENCE_TYPES,
  type SupplierLedgerEntryType,
  type SupplierLedgerReferenceType,
} from "@/lib/constants";

/**
 * Immutable supplier ledger rows.
 *
 * Sign convention (documented for UI + API consumers):
 * - Debit increases payable to the supplier.
 * - Credit decreases payable (payments / advances).
 * - Positive running balance = amount payable to supplier.
 *
 * Running balance is computed on read; it is never stored here.
 */
export interface ISupplierLedgerEntry {
  businessId: Types.ObjectId;
  supplierId: Types.ObjectId;
  entryType: SupplierLedgerEntryType;
  entryDate: Date;
  referenceType: SupplierLedgerReferenceType;
  referenceId?: Types.ObjectId | null;
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierLedgerEntrySchema = new Schema<ISupplierLedgerEntry>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
      index: true,
    },
    entryType: {
      type: String,
      enum: SUPPLIER_LEDGER_ENTRY_TYPES,
      required: true,
    },
    entryDate: {
      type: Date,
      required: true,
      index: true,
    },
    referenceType: {
      type: String,
      enum: SUPPLIER_LEDGER_REFERENCE_TYPES,
      required: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    referenceNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    debit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    credit: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

SupplierLedgerEntrySchema.index({
  businessId: 1,
  supplierId: 1,
  entryDate: 1,
  createdAt: 1,
});
SupplierLedgerEntrySchema.index(
  { businessId: 1, entryType: 1, referenceId: 1 },
  {
    unique: true,
    partialFilterExpression: { referenceId: { $type: "objectId" } },
  },
);

function rejectLedgerMutation() {
  throw new Error("Supplier ledger entries are immutable and cannot be modified.");
}

SupplierLedgerEntrySchema.pre("save", function () {
  if (!this.isNew) rejectLedgerMutation();
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
  SupplierLedgerEntrySchema.pre(hook, rejectLedgerMutation);
}

export type SupplierLedgerEntryDocument = InferSchemaType<
  typeof SupplierLedgerEntrySchema
> & {
  _id: Types.ObjectId;
};

type SupplierLedgerEntryModel = Model<ISupplierLedgerEntry>;

export const SupplierLedgerEntry =
  (models.SupplierLedgerEntry as SupplierLedgerEntryModel | undefined) ||
  model<ISupplierLedgerEntry>("SupplierLedgerEntry", SupplierLedgerEntrySchema);
