export type InvoiceType = "TAX_INVOICE" | "BILL_OF_SUPPLY";
export type SupplyType = "INTRA" | "INTER";
export type SalePaymentStatus = "PAID" | "PARTIAL" | "UNPAID";
export type TenderMethod = "CASH" | "UPI" | "CARD" | "BANK_TRANSFER";

export interface PosCategory {
  _id: string;
  name: string;
}

export interface PosProduct {
  _id: string;
  name: string;
  sku: string;
  barcode: string;
  sellingPrice: number;
  currentStock: number;
  unit: string;
  hsn?: string;
  gstRate?: number;
  category?: { _id: string; name: string } | string | null;
}

export interface PosBusiness {
  name: string;
  legalName: string;
  gstin: string;
  isGstRegistered: boolean;
  pricesIncludeGst: boolean;
  stateCode: string;
  stateName: string;
  phone: string;
  storeName: string;
}

export interface PosCustomer {
  _id: string;
  name: string;
  phone?: string;
  gstin?: string;
  stateCode?: string;
}

export interface QuoteLine {
  productId: string;
  productName: string;
  sku: string;
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

export interface QuoteTotals {
  subtotal: number;
  itemDiscount: number;
  billDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
}

export interface SettledPayment {
  method: string;
  amount: number;
  tenderedAmount: number;
  changeGiven: number;
  referenceNumber: string;
  status: string;
  verification: string;
}

export interface SaleQuote {
  invoiceType: InvoiceType;
  supplyType: SupplyType;
  pricesIncludeGst: boolean;
  lines: QuoteLine[];
  totals: QuoteTotals;
  settlement: {
    amountPaid: number;
    balanceDue: number;
    changeGiven: number;
    paymentStatus: SalePaymentStatus;
    payments: SettledPayment[];
  } | null;
}

export interface InvoiceSnapshot {
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

export interface SaleItemRecord {
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

export interface SaleRecord {
  _id: string;
  saleNumber: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  supplyType: SupplyType;
  paymentStatus: SalePaymentStatus;
  saleStatus: string;
  pricesIncludeGst: boolean;
  notes: string;
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
  createdAt: string;
  items?: SaleItemRecord[];
  invoiceSnapshot: InvoiceSnapshot;
}

export interface PaymentRecord {
  _id: string;
  paymentMethod: string;
  amount: number;
  tenderedAmount: number;
  changeGiven: number;
  referenceNumber: string;
  status: string;
  verification: string;
  createdAt?: string;
}

export function paymentMethodLabel(method: string) {
  switch (method) {
    case "CASH":
      return "Cash";
    case "UPI":
      return "UPI";
    case "CARD":
      return "Card";
    case "BANK_TRANSFER":
      return "Bank transfer";
    case "CREDIT":
      return "Udhaar";
    default:
      return method;
  }
}

export function paymentRecordLabel(payment: {
  paymentMethod?: string;
  method?: string;
  status: string;
  verification?: string;
}) {
  const method = paymentMethodLabel(payment.paymentMethod || payment.method || "");
  if (payment.status === "MANUALLY_CONFIRMED" || payment.verification === "MANUAL") {
    return `${method} · manually confirmed`;
  }
  if (payment.status === "CREDIT" || payment.paymentMethod === "CREDIT" || payment.method === "CREDIT") {
    return "Udhaar";
  }
  return method;
}
