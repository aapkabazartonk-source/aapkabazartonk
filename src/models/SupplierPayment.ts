import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  SUPPLIER_PAYMENT_METHODS,
  type SupplierPaymentMethod,
} from "@/lib/constants";

export interface ISupplierPaymentAllocation {
  purchaseId: Types.ObjectId;
  amount: number;
}

export interface ISupplierPayment {
  businessId: Types.ObjectId;
  supplierId: Types.ObjectId;
  paymentNumber: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentDate: Date;
  referenceNumber: string;
  allocatedPurchases: ISupplierPaymentAllocation[];
  /** Remainder recorded as supplier advance (not silently applied to purchases). */
  unallocatedAmount: number;
  notes: string;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AllocationSchema = new Schema<ISupplierPaymentAllocation>(
  {
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Allocation amount must be greater than 0"],
    },
  },
  { _id: false },
);

const SupplierPaymentSchema = new Schema<ISupplierPayment>(
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
    paymentNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Payment amount must be greater than 0"],
    },
    paymentMethod: {
      type: String,
      enum: SUPPLIER_PAYMENT_METHODS,
      required: true,
    },
    paymentDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    referenceNumber: {
      type: String,
      default: "",
      trim: true,
      maxlength: [80, "Reference number cannot exceed 80 characters"],
    },
    allocatedPurchases: {
      type: [AllocationSchema],
      default: [],
    },
    unallocatedAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Notes cannot exceed 2000 characters"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

SupplierPaymentSchema.index(
  { businessId: 1, paymentNumber: 1 },
  { unique: true },
);
SupplierPaymentSchema.index({
  businessId: 1,
  supplierId: 1,
  paymentDate: -1,
});
SupplierPaymentSchema.index({ businessId: 1, createdAt: -1 });
SupplierPaymentSchema.index({ businessId: 1, paymentDate: -1 });

function rejectSupplierPaymentMutation() {
  throw new Error("Supplier payment records are immutable and cannot be modified.");
}

SupplierPaymentSchema.pre("save", function () {
  if (!this.isNew) rejectSupplierPaymentMutation();
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
  SupplierPaymentSchema.pre(hook, rejectSupplierPaymentMutation);
}

export type SupplierPaymentDocument = InferSchemaType<
  typeof SupplierPaymentSchema
> & {
  _id: Types.ObjectId;
};

type SupplierPaymentModel = Model<ISupplierPayment>;

export const SupplierPayment =
  (models.SupplierPayment as SupplierPaymentModel | undefined) ||
  model<ISupplierPayment>("SupplierPayment", SupplierPaymentSchema);
