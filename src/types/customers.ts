import type { PaginationMeta } from "@/types/catalog";
import type { CustomerType } from "@/lib/constants";
import type { SalePaymentStatus } from "@/types/billing";

export interface CustomerRecord {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  gstin?: string;
  customerType: CustomerType;
  notes?: string;
  isActive: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  totalPurchases?: number;
  totalAmountSpent?: number;
  lastPurchaseAt?: string | null;
}

export interface CustomerStats {
  totalCustomers: number;
  newCustomersThisMonth: number;
}

export interface CustomerListResponse {
  data: CustomerRecord[];
  pagination: PaginationMeta;
  stats: CustomerStats;
}

export interface CustomerOption {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  customerType: CustomerType;
  gstin?: string;
  stateCode?: string;
  address?: string;
  city?: string;
  state?: string;
}

export interface CustomerPurchaseRecord {
  _id: string;
  invoiceNumber: string;
  saleNumber: string;
  date: string;
  itemsCount: number;
  totalAmount: number;
  paymentStatus: SalePaymentStatus;
  saleStatus: string;
}

export interface CustomerDetailResponse {
  data: CustomerRecord & {
    stats: {
      totalPurchases: number;
      totalAmountSpent: number;
      averagePurchaseValue: number;
      lastPurchaseAt: string | null;
    };
    purchases: {
      data: CustomerPurchaseRecord[];
      pagination: PaginationMeta;
    };
  };
}
