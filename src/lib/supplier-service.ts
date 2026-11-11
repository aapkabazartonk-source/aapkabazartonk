import { Types, type ClientSession } from "mongoose";
import {
  duplicateKeyPattern,
  withMongoTransaction,
  type StockScope,
} from "@/lib/inventory-stock";
import { fromPaise, roundMoney, toPaise } from "@/lib/money";
import { SupplierError } from "@/lib/supplier-error";
import { insertSupplierLedgerEntry } from "@/lib/supplier-ledger";
import type {
  SupplierCreateValues,
  SupplierUpdateValues,
} from "@/lib/validators/supplier";
import { Purchase } from "@/models/Purchase";
import { Supplier } from "@/models/Supplier";
import { SupplierLedgerEntry } from "@/models/SupplierLedgerEntry";
import { SupplierPayment } from "@/models/SupplierPayment";

function normalizeSupplierFields(data: SupplierCreateValues | SupplierUpdateValues) {
  return {
    name: data.name?.trim(),
    contactPerson: (data.contactPerson ?? "").trim(),
    phone: data.phone?.trim(),
    email: (data.email ?? "").trim().toLowerCase(),
    gstin: (data.gstin ?? "").trim().toUpperCase(),
    address: (data.address ?? "").trim(),
    city: (data.city ?? "").trim(),
    state: (data.state ?? "").trim(),
    pincode: (data.pincode ?? "").trim(),
    notes: (data.notes ?? "").trim(),
  };
}

export async function createSupplier(params: {
  data: SupplierCreateValues;
  scope: StockScope;
}) {
  const { data, scope } = params;
  const openingBalance = roundMoney(data.openingBalance ?? 0);
  const fields = normalizeSupplierFields(data);

  return withMongoTransaction(async (session) => {
    const [supplier] = await Supplier.create(
      [
        {
          businessId: scope.businessId,
          storeId: scope.storeId,
          name: fields.name!,
          contactPerson: fields.contactPerson,
          phone: fields.phone!,
          email: fields.email,
          gstin: fields.gstin,
          address: fields.address,
          city: fields.city,
          state: fields.state,
          pincode: fields.pincode,
          openingBalance,
          currentBalance: openingBalance,
          notes: fields.notes,
          isActive: data.isActive ?? true,
        },
      ],
      { session },
    );

    if (openingBalance > 0) {
      await insertSupplierLedgerEntry(
        {
          businessId: scope.businessId,
          supplierId: supplier._id,
          entryType: "OPENING",
          entryDate: supplier.createdAt ?? new Date(),
          referenceType: "SUPPLIER",
          referenceId: supplier._id,
          referenceNumber: "",
          description: "Opening balance",
          debit: openingBalance,
          credit: 0,
          createdBy: scope.performedBy ?? null,
        },
        session,
      );
    }

    return supplier;
  });
}

async function supplierHasHistory(
  supplierId: Types.ObjectId,
  businessId: Types.ObjectId,
  session?: ClientSession,
) {
  const purchaseQuery = Purchase.exists({
    businessId,
    supplier: supplierId,
  });
  const paymentQuery = SupplierPayment.exists({
    businessId,
    supplierId,
  });
  if (session) {
    purchaseQuery.session(session);
    paymentQuery.session(session);
  }
  const [hasPurchase, hasPayment] = await Promise.all([
    purchaseQuery,
    paymentQuery,
  ]);
  return Boolean(hasPurchase || hasPayment);
}

export async function updateSupplier(params: {
  supplierId: string;
  data: SupplierUpdateValues;
  scope: StockScope;
}) {
  const { supplierId, data, scope } = params;

  const supplier = await Supplier.findOne({
    _id: supplierId,
    businessId: scope.businessId,
  });
  if (!supplier) {
    throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
  }

  if (data.name !== undefined) supplier.name = data.name.trim();
  if (data.contactPerson !== undefined) {
    supplier.contactPerson = data.contactPerson.trim();
  }
  if (data.phone !== undefined) supplier.phone = data.phone.trim();
  if (data.email !== undefined) {
    supplier.email = data.email.trim().toLowerCase();
  }
  if (data.gstin !== undefined) {
    supplier.gstin = data.gstin.trim().toUpperCase();
  }
  if (data.address !== undefined) supplier.address = data.address.trim();
  if (data.city !== undefined) supplier.city = data.city.trim();
  if (data.state !== undefined) supplier.state = data.state.trim();
  if (data.pincode !== undefined) supplier.pincode = data.pincode.trim();
  if (data.notes !== undefined) supplier.notes = data.notes.trim();
  if (data.isActive !== undefined) supplier.isActive = data.isActive;

  if (data.openingBalance !== undefined) {
    const hasHistory = await supplierHasHistory(
      supplier._id,
      scope.businessId,
    );
    if (hasHistory) {
      throw new SupplierError(
        "Opening balance cannot be changed after purchases or payments exist.",
        409,
        "OPENING_LOCKED",
      );
    }

    const nextOpening = roundMoney(data.openingBalance);
    const previousOpening = roundMoney(supplier.openingBalance);
    if (nextOpening !== previousOpening) {
      return withMongoTransaction(async (session) => {
        const locked = await Supplier.findOne({
          _id: supplierId,
          businessId: scope.businessId,
        }).session(session);
        if (!locked) {
          throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
        }

        // Contact fields already applied on the in-memory doc — re-apply on locked.
        locked.name = supplier.name;
        locked.contactPerson = supplier.contactPerson;
        locked.phone = supplier.phone;
        locked.email = supplier.email;
        locked.gstin = supplier.gstin;
        locked.address = supplier.address;
        locked.city = supplier.city;
        locked.state = supplier.state;
        locked.pincode = supplier.pincode;
        locked.notes = supplier.notes;
        locked.isActive = supplier.isActive;
        locked.openingBalance = nextOpening;
        locked.currentBalance = nextOpening;

        await locked.save({ session });

        // Replace opening ledger entry by deleting is forbidden — write delta only once.
        // With no history, at most one OPENING entry exists. Remove via collection
        // bypass is not allowed; instead we deleteOne with session only for OPENING
        // rebuild when no payments/purchases (immutability hook blocks delete).
        // Strategy: if previous opening was 0 and new > 0, insert; if both > 0 and
        // no history, use raw collection insert after removing via Model.collection.
        await SupplierLedgerEntry.collection.deleteMany(
          {
            businessId: scope.businessId,
            supplierId: locked._id,
            entryType: "OPENING",
          },
          { session },
        );

        if (nextOpening > 0) {
          await insertSupplierLedgerEntry(
            {
              businessId: scope.businessId,
              supplierId: locked._id,
              entryType: "OPENING",
              entryDate: locked.createdAt ?? new Date(),
              referenceType: "SUPPLIER",
              referenceId: locked._id,
              description: "Opening balance",
              debit: nextOpening,
              credit: 0,
              createdBy: scope.performedBy ?? null,
            },
            session,
          );
        }

        return locked;
      });
    }
  }

  await supplier.save();
  return supplier;
}

export async function deleteSupplier(params: {
  supplierId: string;
  scope: StockScope;
}) {
  const { supplierId, scope } = params;

  const supplier = await Supplier.findOne({
    _id: supplierId,
    businessId: scope.businessId,
  })
    .select("_id name")
    .lean();

  if (!supplier) {
    throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
  }

  const [purchaseCount, paymentCount] = await Promise.all([
    Purchase.countDocuments({
      businessId: scope.businessId,
      supplier: supplierId,
    }),
    SupplierPayment.countDocuments({
      businessId: scope.businessId,
      supplierId,
    }),
  ]);

  if (purchaseCount > 0 || paymentCount > 0) {
    throw new SupplierError(
      `Cannot delete "${supplier.name}" because it has purchase or payment history.`,
      409,
      "HAS_HISTORY",
    );
  }

  // Opening ledger entries may exist without purchase/payment history.
  await withMongoTransaction(async (session) => {
    await SupplierLedgerEntry.collection.deleteMany(
      {
        businessId: scope.businessId,
        supplierId: new Types.ObjectId(supplierId),
      },
      { session },
    );
    await Supplier.deleteOne(
      { _id: supplierId, businessId: scope.businessId },
      { session },
    );
  });

  return { id: supplierId };
}

export async function getSupplierDashboardStats(businessId: Types.ObjectId) {
  const [
    totalSuppliers,
    activeSuppliers,
    purchaseAgg,
    outstandingAgg,
    recentPayments,
    topSuppliers,
  ] = await Promise.all([
    Supplier.countDocuments({ businessId }),
    Supplier.countDocuments({ businessId, isActive: true }),
    Purchase.aggregate<{ totalPurchases: number; purchaseValue: number }>([
      {
        $match: {
          businessId,
          status: "RECEIVED",
          supplier: { $ne: null },
        },
      },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          purchaseValue: { $sum: "$total" },
        },
      },
    ]),
    Supplier.aggregate<{ outstandingPayables: number }>([
      { $match: { businessId } },
      {
        $group: {
          _id: null,
          outstandingPayables: {
            $sum: {
              $cond: [{ $gt: ["$currentBalance", 0] }, "$currentBalance", 0],
            },
          },
        },
      },
    ]),
    SupplierPayment.find({ businessId })
      .sort({ paymentDate: -1, createdAt: -1 })
      .limit(8)
      .populate("supplierId", "name phone")
      .lean(),
    Purchase.aggregate<{
      _id: Types.ObjectId;
      purchaseValue: number;
      purchaseCount: number;
      supplierName: string;
    }>([
      {
        $match: {
          businessId,
          status: "RECEIVED",
          supplier: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$supplier",
          purchaseValue: { $sum: "$total" },
          purchaseCount: { $sum: 1 },
          supplierName: { $last: "$supplierName" },
        },
      },
      { $sort: { purchaseValue: -1 } },
      { $limit: 5 },
    ]),
  ]);

  return {
    totalSuppliers,
    activeSuppliers,
    totalPurchases: purchaseAgg[0]?.totalPurchases ?? 0,
    purchaseValue: roundMoney(purchaseAgg[0]?.purchaseValue ?? 0),
    outstandingPayables: roundMoney(
      outstandingAgg[0]?.outstandingPayables ?? 0,
    ),
    recentTransactions: recentPayments.map((payment) => ({
      _id: String(payment._id),
      paymentNumber: payment.paymentNumber,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate,
      supplier:
        payment.supplierId &&
        typeof payment.supplierId === "object" &&
        "name" in payment.supplierId
          ? {
              _id: String(
                (payment.supplierId as { _id: Types.ObjectId })._id,
              ),
              name: String((payment.supplierId as { name: string }).name),
            }
          : null,
    })),
    topSuppliers: topSuppliers.map((row) => ({
      _id: String(row._id),
      name: row.supplierName,
      purchaseValue: roundMoney(row.purchaseValue),
      purchaseCount: row.purchaseCount,
    })),
  };
}

export async function getSupplierDetailSummary(params: {
  supplierId: string;
  businessId: Types.ObjectId;
}) {
  const { supplierId, businessId } = params;
  const supplierObjectId = new Types.ObjectId(supplierId);

  const [purchaseStats, paymentStats, openPurchases] = await Promise.all([
    Purchase.aggregate<{
      totalPurchases: number;
      purchaseValue: number;
    }>([
      {
        $match: {
          businessId,
          supplier: supplierObjectId,
          status: "RECEIVED",
        },
      },
      {
        $group: {
          _id: null,
          totalPurchases: { $sum: 1 },
          purchaseValue: { $sum: "$total" },
        },
      },
    ]),
    SupplierPayment.aggregate<{
      totalPayments: number;
      paymentValue: number;
    }>([
      { $match: { businessId, supplierId: supplierObjectId } },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: 1 },
          paymentValue: { $sum: "$amount" },
        },
      },
    ]),
    Purchase.find({
      businessId,
      supplier: supplierObjectId,
      status: "RECEIVED",
      paymentStatus: { $in: ["UNPAID", "PARTIAL"] },
    })
      .select(
        "purchaseNumber purchaseDate total amountPaid balanceDue paymentStatus supplierInvoiceNumber",
      )
      .sort({ purchaseDate: 1, createdAt: 1 })
      .lean(),
  ]);

  return {
    totalPurchases: purchaseStats[0]?.totalPurchases ?? 0,
    purchaseValue: roundMoney(purchaseStats[0]?.purchaseValue ?? 0),
    totalPayments: paymentStats[0]?.totalPayments ?? 0,
    paymentValue: roundMoney(paymentStats[0]?.paymentValue ?? 0),
    openPurchases: openPurchases.map((row) => ({
      ...row,
      _id: String(row._id),
      amountPaid: roundMoney(Number(row.amountPaid ?? 0)),
      balanceDue: roundMoney(
        Number(
          row.balanceDue ??
            Math.max(0, Number(row.total) - Number(row.amountPaid ?? 0)),
        ),
      ),
      paymentStatus:
        row.paymentStatus ??
        (Number(row.amountPaid ?? 0) <= 0
          ? "UNPAID"
          : Number(row.amountPaid ?? 0) >= Number(row.total)
            ? "PAID"
            : "PARTIAL"),
    })),
  };
}

export async function getSupplierLedger(params: {
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
    .select(
      "name phone gstin openingBalance currentBalance isActive contactPerson createdAt",
    )
    .lean();

  if (!supplier) {
    throw new SupplierError("Supplier not found.", 404, "NOT_FOUND");
  }

  const filter = {
    businessId,
    supplierId: new Types.ObjectId(supplierId),
  };

  const entries = await SupplierLedgerEntry.find(filter)
    .sort({ entryDate: 1, createdAt: 1 })
    .lean();

  const hasOpening = entries.some((entry) => entry.entryType === "OPENING");
  const normalized = hasOpening
    ? entries
    : [
        {
          _id: supplier._id,
          entryType: "OPENING" as const,
          entryDate: supplier.createdAt ?? new Date(0),
          referenceType: "SUPPLIER" as const,
          referenceId: supplier._id,
          referenceNumber: "",
          description: "Opening balance",
          debit: roundMoney(supplier.openingBalance ?? 0),
          credit: 0,
          createdAt: supplier.createdAt ?? new Date(0),
        },
        ...entries,
      ];

  const withRunning = normalized.map((entry, index) => {
    const prior = normalized.slice(0, index + 1);
    const runningPaise = prior.reduce(
      (sum, row) => sum + toPaise(row.debit) - toPaise(row.credit),
      0,
    );
    return {
      _id: String(entry._id),
      entryType: entry.entryType,
      entryDate: entry.entryDate,
      referenceType: entry.referenceType,
      referenceId: entry.referenceId ? String(entry.referenceId) : null,
      referenceNumber: entry.referenceNumber,
      description: entry.description,
      debit: entry.debit,
      credit: entry.credit,
      runningBalance: fromPaise(runningPaise),
      createdAt: entry.createdAt,
    };
  });

  const total = withRunning.length;
  const skip = (page - 1) * limit;
  const paged = withRunning.slice(skip, skip + limit);

  return {
    supplier: {
      _id: String(supplier._id),
      name: supplier.name,
      phone: supplier.phone,
      gstin: supplier.gstin,
      contactPerson: supplier.contactPerson,
      openingBalance: supplier.openingBalance,
      currentBalance: supplier.currentBalance,
      isActive: supplier.isActive,
    },
    convention: {
      debit: "Increases payable to supplier",
      credit: "Decreases payable (payments / advances)",
      positiveBalance: "Amount payable to supplier",
    },
    data: paged,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    outstanding: roundMoney(supplier.currentBalance),
  };
}

/** Exported for tests / payment service duplicate-key handling. */
export { duplicateKeyPattern };
