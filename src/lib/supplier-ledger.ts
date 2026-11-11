import { Types, type ClientSession } from "mongoose";
import type {
  SupplierLedgerEntryType,
  SupplierLedgerReferenceType,
} from "@/lib/constants";
import { fromPaise, roundMoney, toPaise } from "@/lib/money";
import { SupplierLedgerEntry } from "@/models/SupplierLedgerEntry";

/**
 * Supplier ledger sign convention:
 * - Debit increases payable to the supplier.
 * - Credit decreases payable (payments and advances).
 * - Positive running balance = amount payable to supplier.
 */
export async function insertSupplierLedgerEntry(
  params: {
    businessId: Types.ObjectId;
    supplierId: Types.ObjectId;
    entryType: SupplierLedgerEntryType;
    entryDate: Date;
    referenceType: SupplierLedgerReferenceType;
    referenceId?: Types.ObjectId | null;
    referenceNumber?: string;
    description: string;
    debit?: number;
    credit?: number;
    createdBy?: Types.ObjectId | null;
  },
  session?: ClientSession,
) {
  const debit = roundMoney(params.debit ?? 0);
  const credit = roundMoney(params.credit ?? 0);
  if (debit < 0 || credit < 0) {
    throw new Error("Ledger debit/credit cannot be negative.");
  }
  if (debit === 0 && credit === 0) {
    return null;
  }

  const [entry] = await SupplierLedgerEntry.create(
    [
      {
        businessId: params.businessId,
        supplierId: params.supplierId,
        entryType: params.entryType,
        entryDate: params.entryDate,
        referenceType: params.referenceType,
        referenceId: params.referenceId ?? null,
        referenceNumber: (params.referenceNumber ?? "").trim(),
        description: params.description.trim(),
        debit,
        credit,
        createdBy: params.createdBy ?? null,
      },
    ],
    session ? { session } : undefined,
  );

  return entry;
}

export function paymentStatusFromAmounts(total: number, amountPaid: number) {
  const totalPaise = toPaise(total);
  const paidPaise = toPaise(amountPaid);
  if (paidPaise <= 0) return "UNPAID" as const;
  if (paidPaise >= totalPaise) return "PAID" as const;
  return "PARTIAL" as const;
}

export function computeRunningBalances(
  entries: Array<{ debit: number; credit: number }>,
) {
  let runningPaise = 0;
  return entries.map((entry) => {
    runningPaise += toPaise(entry.debit) - toPaise(entry.credit);
    return fromPaise(runningPaise);
  });
}
