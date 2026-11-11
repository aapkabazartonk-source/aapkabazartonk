import {
  Schema,
  models,
  model,
  type InferSchemaType,
  type Model,
  type Types,
} from "mongoose";
import type {
  InvoicePaperSize,
  InvoiceType,
  TenderMethod,
} from "@/lib/constants";

const INVOICE_PAPER_SIZE_VALUES: InvoicePaperSize[] = [
  "58mm",
  "80mm",
  "A4",
  "6x4",
];
const INVOICE_TYPE_VALUES: InvoiceType[] = ["TAX_INVOICE", "BILL_OF_SUPPLY"];
const TENDER_METHOD_VALUES: TenderMethod[] = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
];

/**
 * Nested configuration for one business.
 * Core identity/GST fields stay on Business/Store — this document holds
 * invoice, printer, billing preferences and optional permission overrides.
 */
export interface IBusinessSettingsInvoice {
  taxInvoicePrefix: string;
  billOfSupplyPrefix: string;
  salePrefix: string;
  paperSize: InvoicePaperSize;
  showLogo: boolean;
  showGstin: boolean;
  showAddress: boolean;
  footerNote: string;
  termsAndConditions: string;
  thankYouMessage: string;
  template: "standard";
}

export interface IBusinessSettingsPrinter {
  defaultPrinterLabel: string;
  paperSize: InvoicePaperSize;
  autoPrintAfterBilling: boolean;
  printLogo: boolean;
  printPreview: boolean;
  /** Browser print notes shown in UI — discovery is not implemented. */
  notes: string;
}

export interface IBusinessSettingsBilling {
  defaultPaymentMethod: TenderMethod;
  enabledPaymentMethods: TenderMethod[];
  enableBillDiscount: boolean;
  maxBillDiscountPercent: number;
  maxBillDiscountAmount: number;
  defaultInvoiceTypePreference: "AUTO" | InvoiceType;
  showStockAvailability: boolean;
  searchIncludesBarcode: boolean;
  searchIncludesSku: boolean;
  requireCheckoutConfirmation: boolean;
  autoPrintAfterBilling: boolean;
  allowCreditSales: boolean;
  keyboardShortcutsEnabled: boolean;
}

export interface IBusinessSettingsSecurity {
  requirePasswordChangeOnNextLogin: boolean;
  sessionTimeoutMinutes: number;
}

export interface IBusinessSettings {
  businessId: Types.ObjectId;
  invoice: IBusinessSettingsInvoice;
  printer: IBusinessSettingsPrinter;
  billing: IBusinessSettingsBilling;
  security: IBusinessSettingsSecurity;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceSettingsSchema = new Schema<IBusinessSettingsInvoice>(
  {
    taxInvoicePrefix: {
      type: String,
      default: "INV",
      trim: true,
      uppercase: true,
      maxlength: 12,
    },
    billOfSupplyPrefix: {
      type: String,
      default: "BOS",
      trim: true,
      uppercase: true,
      maxlength: 12,
    },
    salePrefix: {
      type: String,
      default: "SAL",
      trim: true,
      uppercase: true,
      maxlength: 12,
    },
    paperSize: {
      type: String,
      enum: INVOICE_PAPER_SIZE_VALUES,
      default: "80mm",
    },
    showLogo: { type: Boolean, default: true },
    showGstin: { type: Boolean, default: true },
    showAddress: { type: Boolean, default: true },
    footerNote: { type: String, default: "", trim: true, maxlength: 500 },
    termsAndConditions: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
    thankYouMessage: {
      type: String,
      default: "Thank you for shopping with us!",
      trim: true,
      maxlength: 200,
    },
    template: { type: String, enum: ["standard"], default: "standard" },
  },
  { _id: false },
);

const PrinterSettingsSchema = new Schema<IBusinessSettingsPrinter>(
  {
    defaultPrinterLabel: {
      type: String,
      default: "Browser default",
      trim: true,
      maxlength: 120,
    },
    paperSize: {
      type: String,
      enum: INVOICE_PAPER_SIZE_VALUES,
      default: "80mm",
    },
    autoPrintAfterBilling: { type: Boolean, default: false },
    printLogo: { type: Boolean, default: true },
    printPreview: { type: Boolean, default: true },
    notes: {
      type: String,
      default:
        "Printing uses the browser print dialog. USB thermal printer discovery is not available in this app — choose your printer in the OS print dialog.",
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const BillingSettingsSchema = new Schema<IBusinessSettingsBilling>(
  {
    defaultPaymentMethod: {
      type: String,
      enum: TENDER_METHOD_VALUES,
      default: "CASH",
    },
    enabledPaymentMethods: {
      type: [String],
      enum: TENDER_METHOD_VALUES,
      default: [...TENDER_METHOD_VALUES],
    },
    enableBillDiscount: { type: Boolean, default: true },
    maxBillDiscountPercent: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    maxBillDiscountAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    defaultInvoiceTypePreference: {
      type: String,
      enum: ["AUTO", ...INVOICE_TYPE_VALUES],
      default: "AUTO",
    },
    showStockAvailability: { type: Boolean, default: true },
    searchIncludesBarcode: { type: Boolean, default: true },
    searchIncludesSku: { type: Boolean, default: true },
    requireCheckoutConfirmation: { type: Boolean, default: true },
    autoPrintAfterBilling: { type: Boolean, default: false },
    allowCreditSales: { type: Boolean, default: true },
    keyboardShortcutsEnabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const SecuritySettingsSchema = new Schema<IBusinessSettingsSecurity>(
  {
    requirePasswordChangeOnNextLogin: { type: Boolean, default: false },
    sessionTimeoutMinutes: {
      type: Number,
      default: 480,
      min: 15,
      max: 10080,
    },
  },
  { _id: false },
);

const BusinessSettingsSchema = new Schema<IBusinessSettings>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      unique: true,
      index: true,
    },
    invoice: { type: InvoiceSettingsSchema, default: () => ({}) },
    printer: { type: PrinterSettingsSchema, default: () => ({}) },
    billing: { type: BillingSettingsSchema, default: () => ({}) },
    security: { type: SecuritySettingsSchema, default: () => ({}) },
  },
  { timestamps: true },
);

export type BusinessSettingsDocument = InferSchemaType<
  typeof BusinessSettingsSchema
> & {
  _id: Types.ObjectId;
};

type BusinessSettingsModel = Model<IBusinessSettings>;

export const BusinessSettings =
  (models.BusinessSettings as BusinessSettingsModel | undefined) ||
  model<IBusinessSettings>("BusinessSettings", BusinessSettingsSchema);

export const DEFAULT_INVOICE_SETTINGS: IBusinessSettingsInvoice = {
  taxInvoicePrefix: "INV",
  billOfSupplyPrefix: "BOS",
  salePrefix: "SAL",
  paperSize: "80mm",
  showLogo: true,
  showGstin: true,
  showAddress: true,
  footerNote: "",
  termsAndConditions: "",
  thankYouMessage: "Thank you for shopping with us!",
  template: "standard",
};

export const DEFAULT_PRINTER_SETTINGS: IBusinessSettingsPrinter = {
  defaultPrinterLabel: "Browser default",
  paperSize: "80mm",
  autoPrintAfterBilling: false,
  printLogo: true,
  printPreview: true,
  notes:
    "Printing uses the browser print dialog. USB thermal printer discovery is not available in this app — choose your printer in the OS print dialog.",
};

export const DEFAULT_BILLING_SETTINGS: IBusinessSettingsBilling = {
  defaultPaymentMethod: "CASH",
  enabledPaymentMethods: [...TENDER_METHOD_VALUES],
  enableBillDiscount: true,
  maxBillDiscountPercent: 100,
  maxBillDiscountAmount: 0,
  defaultInvoiceTypePreference: "AUTO",
  showStockAvailability: true,
  searchIncludesBarcode: true,
  searchIncludesSku: true,
  requireCheckoutConfirmation: true,
  autoPrintAfterBilling: false,
  allowCreditSales: true,
  keyboardShortcutsEnabled: true,
};

export const DEFAULT_SECURITY_SETTINGS: IBusinessSettingsSecurity = {
  requirePasswordChangeOnNextLogin: false,
  sessionTimeoutMinutes: 480,
};
