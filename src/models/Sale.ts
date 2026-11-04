import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import {
  INVOICE_TYPES,
  SALE_PAYMENT_STATUSES,
  SALE_STATUSES,
  SUPPLY_TYPES,
  type InvoiceType,
  type SalePaymentStatus,
  type SaleStatus,
  type SupplyType,
} from "@/lib/constants";

export interface ISaleItem {
  product: Types.ObjectId;
  productName: string;
  sku: string;
  barcode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  billDiscountShare: number;
  hsn: string;
  taxRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  finalAmount: number;
}

export interface IInvoiceSnapshot {
  businessName: string;
  legalName: string;
  gstin: string;
  isGstRegistered: boolean;
  stateCode: string;
  stateName: string;
  address: string;
  phone: string;
  storeName: string;
  storeCode: string;
  pricesIncludeGst: boolean;
  customerName: string;
  customerPhone: string;
  customerGstin: string;
  customerAddress: string;
  customerStateCode: string;
  customerStateName: string;
  supplyType: SupplyType;
  placeOfSupply: string;
}

export interface ISale {
  businessId: Types.ObjectId;
  storeId: Types.ObjectId;
  saleNumber: string;
  invoiceNumber: string;
  idempotencyKey: string;
  customer?: Types.ObjectId | null;
  items: ISaleItem[];
  subtotal: number;
  itemDiscount: number;
  billDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  changeGiven: number;
  paymentStatus: SalePaymentStatus;
  saleStatus: SaleStatus;
  invoiceType: InvoiceType;
  supplyType: SupplyType;
  pricesIncludeGst: boolean;
  notes: string;
  invoiceSnapshot: IInvoiceSnapshot;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema<ISaleItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, default: "", trim: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true, trim: true },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, required: true, min: 0, default: 0 },
    billDiscountShare: { type: Number, required: true, min: 0, default: 0 },
    hsn: { type: String, default: "", trim: true },
    taxRate: { type: Number, required: true, min: 0, max: 100 },
    taxableAmount: { type: Number, required: true, min: 0 },
    cgst: { type: Number, required: true, min: 0, default: 0 },
    sgst: { type: Number, required: true, min: 0, default: 0 },
    igst: { type: Number, required: true, min: 0, default: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    finalAmount: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const InvoiceSnapshotSchema = new Schema<IInvoiceSnapshot>(
  {
    businessName: { type: String, default: "", trim: true },
    legalName: { type: String, default: "", trim: true },
    gstin: { type: String, default: "", trim: true, uppercase: true },
    isGstRegistered: { type: Boolean, default: false },
    stateCode: { type: String, default: "", trim: true },
    stateName: { type: String, default: "", trim: true },
    address: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    storeName: { type: String, default: "", trim: true },
    storeCode: { type: String, default: "", trim: true },
    pricesIncludeGst: { type: Boolean, default: false },
    customerName: { type: String, default: "Walk-in customer", trim: true },
    customerPhone: { type: String, default: "", trim: true },
    customerGstin: { type: String, default: "", trim: true, uppercase: true },
    customerAddress: { type: String, default: "", trim: true },
    customerStateCode: { type: String, default: "", trim: true },
    customerStateName: { type: String, default: "", trim: true },
    supplyType: { type: String, enum: SUPPLY_TYPES, required: true },
    placeOfSupply: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const SaleSchema = new Schema<ISale>(
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
    saleNumber: { type: String, required: true, trim: true, uppercase: true },
    invoiceNumber: { type: String, required: true, trim: true, uppercase: true },
    idempotencyKey: { type: String, required: true, trim: true },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
      index: true,
    },
    items: {
      type: [SaleItemSchema],
      required: true,
      validate: {
        validator: (items: ISaleItem[]) => Array.isArray(items) && items.length > 0,
        message: "Sale must include at least one item",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    itemDiscount: { type: Number, required: true, min: 0, default: 0 },
    billDiscount: { type: Number, required: true, min: 0, default: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    cgst: { type: Number, required: true, min: 0, default: 0 },
    sgst: { type: Number, required: true, min: 0, default: 0 },
    igst: { type: Number, required: true, min: 0, default: 0 },
    totalTax: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, required: true, min: 0, default: 0 },
    balanceDue: { type: Number, required: true, min: 0, default: 0 },
    changeGiven: { type: Number, required: true, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: SALE_PAYMENT_STATUSES,
      required: true,
      index: true,
    },
    saleStatus: {
      type: String,
      enum: SALE_STATUSES,
      required: true,
      default: "COMPLETED",
    },
    invoiceType: {
      type: String,
      enum: INVOICE_TYPES,
      required: true,
    },
    supplyType: {
      type: String,
      enum: SUPPLY_TYPES,
      required: true,
    },
    pricesIncludeGst: { type: Boolean, required: true, default: false },
    notes: { type: String, default: "", trim: true, maxlength: 500 },
    invoiceSnapshot: { type: InvoiceSnapshotSchema, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

SaleSchema.index({ businessId: 1, saleNumber: 1 }, { unique: true });
SaleSchema.index({ businessId: 1, invoiceNumber: 1 }, { unique: true });
SaleSchema.index(
  { businessId: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } },
  },
);
SaleSchema.index({ businessId: 1, createdAt: -1 });
SaleSchema.index({ businessId: 1, paymentStatus: 1, createdAt: -1 });

function rejectSaleMutation() {
  throw new Error("Completed sales are immutable and cannot be modified.");
}

SaleSchema.pre("save", function () {
  if (!this.isNew) rejectSaleMutation();
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
  SaleSchema.pre(hook, rejectSaleMutation);
}

export type SaleDocument = InferSchemaType<typeof SaleSchema> & {
  _id: Types.ObjectId;
};

type SaleModel = Model<ISale>;

export const Sale =
  (models.Sale as SaleModel | undefined) || model<ISale>("Sale", SaleSchema);
