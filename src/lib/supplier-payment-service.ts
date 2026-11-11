import { Types, type ClientSession } from "mongoose";
import { nextDailySequence } from "@/lib/document-numbers";
import {
  duplicateKeyPattern,
  withMongoTransaction,
  type StockScope,
} from "@/lib/inventory-stock";
import { fromPaise, roundMoney, toPaise } from "@/lib/money";
import { SupplierError } from "@/lib/supplier-error";
import {
  insertSupplierLedgerEntry,
  paymentStatusFromAmounts,
} from "@/lib/supplier-ledger";
import type { SupplierPaymentCreateValues } from "@/lib/validators/supplier-payment";
import { Purchase } from "@/models/Purchase";
import { Supplier } from "@/models/Supplier";
import { SupplierPayment } from "@/models/SupplierPayment";

async function nextPaymentNumber(
  businessId: Types.ObjectId,
  session?: ClientSession,
) {
  return nextDailySequence(async (prefix) => {
    const query = SupplierPayment.countDocuments({
      businessId,
      paymentNumber: { $regex: `^${prefix}` },
    });
    if (session) query.session(session);
    return query;
  }, "SPAY");
}

function purchaseOutstandingPaise(purchase: {
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  status: string;
}) {
  if (purchase.status !== "RECEIVED") return 0;
  if (purchase.balanceDue !== undefined && purchase.balanceDue !== null) {
    return toPaise(purchase.balanceDue);
  }
  return Math.max(0, toPaise(purchase.total) - toPaise(purchase.amountPaid ?? 0));
}

async function loadOpenPurchasesFifo(
  businessId: Types.ObjectId,
  supplierId: Types.ObjectId,
  session: ClientSession,
) {
  return Purchase.find({
    businessId,
    supplier: supplierId,
    status: "RECEIVED",
    $or: [
      { paymentStatus: { $in: ["UNPAID", "PARTIAL"] } },
      { balanceDue: { $gt: 0 } },
      {
        $expr: {
          $gt: [
            { $subtract: ["$total", { $ifNull: ["$amountPaid", 0] }] },
            0,
          ],
        },
      },
    ],
  })
    .session(session)
    .sort({ purchaseDate: 1, createdAt: 1 });
}

export async function recordSupplierPayment(params: {
  supplierId: string;
  data: SupplierPaymentCreateValues;
  scope: StockScope;
}) {
  const { supplierId, data, scope } = params;
  const amount = roundMoney(data.amount);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await withMongoTransaction(async (session) => {
        const supplier = await Supplier.findOne({
          _id: supplierId,
          businessId: scope.businessId,
        }).session(session);

        if (!supplier) {
          throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
        }

        const openPurchases = await loadOpenPurchasesFifo(
          scope.businessId,
          supplier._id,
          session,
        );

        // Outstanding payable includes opening balance + unpaid purchases − prior advances
        // (maintained on supplier.currentBalance). Purchase rows are only for allocation.
        const outstandingPaise = Math.max(0, toPaise(supplier.currentBalance));
        const paymentPaise = toPaise(amount);

        if (paymentPaise > outstandingPaise && !data.allowAdvance) {
          throw new SupplierError(
            `Payment exceeds outstanding payable of ${fromPaise(outstandingPaise).toFixed(2)}. Set allowAdvance to record the excess as a supplier advance.`,
            409,
            "ADVANCE_REQUIRED",
          );
        }

        let allocations: Array<{ purchaseId: Types.ObjectId; amount: number }> =
          [];
        let remainingPaise = paymentPaise;

        if (data.allocatedPurchases && data.allocatedPurchases.length > 0) {
          const byId = new Map(
            openPurchases.map((purchase) => [String(purchase._id), purchase]),
          );
          for (const row of data.allocatedPurchases) {
            const purchase = byId.get(row.purchaseId);
            if (!purchase) {
              throw new SupplierError(
                "One or more selected purchases are not open payables for this supplier.",
                409,
                "INVALID_ALLOCATION",
              );
            }
            const allocPaise = toPaise(row.amount);
            const duePaise = purchaseOutstandingPaise(purchase);
            if (allocPaise > duePaise) {
              throw new SupplierError(
                `Allocation for ${purchase.purchaseNumber} exceeds its outstanding balance.`,
                409,
                "OVER_ALLOCATION",
              );
            }
            allocations.push({
              purchaseId: purchase._id,
              amount: fromPaise(allocPaise),
            });
            remainingPaise -= allocPaise;
          }
          if (remainingPaise < 0) {
            throw new SupplierError(
              "Allocated total cannot exceed the payment amount.",
              409,
              "OVER_ALLOCATION",
            );
          }
        } else {
          allocations = [];
          for (const purchase of openPurchases) {
            if (remainingPaise <= 0) break;
            const duePaise = purchaseOutstandingPaise(purchase);
            if (duePaise <= 0) continue;
            const applyPaise = Math.min(duePaise, remainingPaise);
            allocations.push({
              purchaseId: purchase._id,
              amount: fromPaise(applyPaise),
            });
            remainingPaise -= applyPaise;
          }
        }

        // Remainder after purchase allocation may cover opening balance (still allocated
        // to supplier payable) or true advance when payment exceeds currentBalance.
        const unallocatedPaise = remainingPaise;
        const advancePaise = Math.max(0, paymentPaise - outstandingPaise);

        // Apply allocations to purchases
        for (const allocation of allocations) {
          const purchase = openPurchases.find(
            (row) => String(row._id) === String(allocation.purchaseId),
          );
          if (!purchase) continue;
          const paid = roundMoney(
            Number(purchase.amountPaid ?? 0) + allocation.amount,
          );
          const due = Math.max(0, roundMoney(purchase.total - paid));
          purchase.amountPaid = paid;
          purchase.balanceDue = due;
          purchase.paymentStatus = paymentStatusFromAmounts(
            purchase.total,
            paid,
          );
          await purchase.save({ session });
        }

        const paymentNumber = await nextPaymentNumber(
          scope.businessId,
          session,
        );
        const paymentDate = data.paymentDate ?? new Date();

        const [payment] = await SupplierPayment.create(
          [
            {
              businessId: scope.businessId,
              supplierId: supplier._id,
              paymentNumber,
              amount,
              paymentMethod: data.paymentMethod,
              paymentDate,
              referenceNumber: (data.referenceNumber ?? "").trim(),
              allocatedPurchases: allocations,
              unallocatedAmount: fromPaise(unallocatedPaise),
              notes: (data.notes ?? "").trim(),
              createdBy: scope.performedBy ?? null,
            },
          ],
          { session },
        );

        const updated = await Supplier.findOneAndUpdate(
          { _id: supplier._id, businessId: scope.businessId },
          { $inc: { currentBalance: -amount } },
          { session, returnDocument: "after" },
        );

        if (!updated) {
          throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
        }

        const advanceNote =
          advancePaise > 0
            ? ` (includes advance ${fromPaise(advancePaise).toFixed(2)})`
            : unallocatedPaise > 0
              ? ` (unallocated ${fromPaise(unallocatedPaise).toFixed(2)})`
              : "";

        await insertSupplierLedgerEntry(
          {
            businessId: scope.businessId,
            supplierId: supplier._id,
            entryType: "PAYMENT",
            entryDate: paymentDate,
            referenceType: "SUPPLIER_PAYMENT",
            referenceId: payment._id,
            referenceNumber: paymentNumber,
            description: `Payment ${paymentNumber}${advanceNote}`,
            debit: 0,
            credit: amount,
            createdBy: scope.performedBy ?? null,
          },
          session,
        );

        return payment;
      });
    } catch (error) {
      const pattern = duplicateKeyPattern(error);
      if (
        pattern &&
        ("paymentNumber" in pattern || "referenceId" in pattern) &&
        attempt < 2
      ) {
        continue;
      }
      throw error;
    }
  }

  throw new SupplierError("Could not allocate a payment number.", 500);
}

export async function listSupplierPayments(params: {
  supplierId: string;
  businessId: Types.ObjectId;
  page: number;
  limit: number;
}) {
  const { supplierId, businessId, page, limit } = params;

  const supplier = await Supplier.findOne({
    _id: supplierId,
    businessId,
  })
    .select("_id name currentBalance")
    .lean();

  if (!supplier) {
    throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
  }

  const filter = {
    businessId,
    supplierId: new Types.ObjectId(supplierId),
  };

  const [total, payments] = await Promise.all([
    SupplierPayment.countDocuments(filter),
    SupplierPayment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  return {
    supplier: {
      _id: String(supplier._id),
      name: supplier.name,
      currentBalance: supplier.currentBalance,
    },
    data: payments.map((payment) => ({
      ...payment,
      _id: String(payment._id),
      supplierId: String(payment.supplierId),
      allocatedPurchases: (payment.allocatedPurchases ?? []).map((row) => ({
        purchaseId: String(row.purchaseId),
        amount: row.amount,
      })),
      createdBy: payment.createdBy ? String(payment.createdBy) : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
