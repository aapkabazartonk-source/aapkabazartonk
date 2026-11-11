import type { PaginationMeta } from "@/types/catalog";

export interface SupplierRecord {
  _id: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  openingBalance: number;
  currentBalance: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierStats {
  totalSuppliers: number;
  activeSuppliers: number;
  totalPurchases: number;
  purchaseValue: number;
  outstandingPayables: number;
  recentTransactions: Array<{
    _id: string;
    paymentNumber: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string;
    supplier: { _id: string; name: string } | null;
  }>;
  topSuppliers: Array<{
    _id: string;
    name: string;
    purchaseValue: number;
    purchaseCount: number;
  }>;
}

export interface SupplierListResponse {
  data: SupplierRecord[];
  pagination: PaginationMeta;
  stats: SupplierStats;
}

export interface SupplierOption {
  _id: string;
  name: string;
  phone: string;
  gstin?: string;
  contactPerson?: string;
  currentBalance?: number;
  isActive: boolean;
}

export interface SupplierLedgerEntryRecord {
  _id: string;
  entryType: string;
  entryDate: string;
  referenceType: string;
  referenceId: string | null;
  referenceNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  createdAt: string;
}

export interface SupplierLedgerResponse {
  supplier: {
    _id: string;
    name: string;
    phone: string;
    gstin?: string;
    contactPerson?: string;
    openingBalance: number;
    currentBalance: number;
    isActive: boolean;
  };
  convention: {
    debit: string;
    credit: string;
    positiveBalance: string;
  };
  data: SupplierLedgerEntryRecord[];
  pagination: PaginationMeta;
  outstanding: number;
}

export interface SupplierPaymentRecord {
  _id: string;
  paymentNumber: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  referenceNumber?: string;
  allocatedPurchases: Array<{ purchaseId: string; amount: number }>;
  unallocatedAmount: number;
  notes?: string;
  createdAt: string;
}

export interface SupplierPaymentListResponse {
  supplier: { _id: string; name: string; currentBalance: number };
  data: SupplierPaymentRecord[];
  pagination: PaginationMeta;
}
