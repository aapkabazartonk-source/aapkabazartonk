import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  PAYMENT_METHODS,
  PAYMENT_RECORD_STATUSES,
  PAYMENT_VERIFICATIONS,
  type PaymentMethod,
  type PaymentRecordStatus,
  type PaymentVerification,
} from "@/lib/constants";

export interface IPayment {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  sale: Types.ObjectId;
  sequence: number;
  paymentMethod: PaymentMethod;
  amount: number;
  tenderedAmount: number;
  changeGiven: number;
  referenceNumber: string;
  status: PaymentRecordStatus;
  verification: PaymentVerification;
  receivedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
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
    sale: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },
    sequence: { type: Number, required: true, min: 1 },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    tenderedAmount: { type: Number, required: true, min: 0, default: 0 },
    changeGiven: { type: Number, required: true, min: 0, default: 0 },
    referenceNumber: { type: String, default: "", trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: PAYMENT_RECORD_STATUSES,
      required: true,
    },
    verification: {
      type: String,
      enum: PAYMENT_VERIFICATIONS,
      required: true,
      default: "MANUAL",
    },
    receivedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

PaymentSchema.index({ businessId: 1, sale: 1, sequence: 1 }, { unique: true });
PaymentSchema.index({ businessId: 1, createdAt: -1 });
PaymentSchema.index({ businessId: 1, storeId: 1, status: 1, createdAt: -1 });

function rejectPaymentMutation() {
  throw new Error("Payment records are immutable and cannot be modified.");
}

PaymentSchema.pre("save", function () {
  if (!this.isNew) rejectPaymentMutation();
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
  PaymentSchema.pre(hook, rejectPaymentMutation);
}

export type PaymentDocument = InferSchemaType<typeof PaymentSchema> & {
  _id: Types.ObjectId;
};

type PaymentModel = Model<IPayment>;

export const Payment =
  (models.Payment as PaymentModel | undefined) ||
  model<IPayment>("Payment", PaymentSchema);
