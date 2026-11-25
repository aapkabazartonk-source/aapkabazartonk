import { Types, type ClientSession } from "mongoose";
import { AccountsError } from "@/lib/accounts-error";
import {
  type AccountTransactionReferenceType,
  type AccountTransactionType,
  type TenderMethod,
} from "@/lib/constants";
import { nextDailySequence } from "@/lib/document-numbers";
import {
  duplicateKeyPattern,
  withMongoTransaction,
  type StockScope,
} from "@/lib/inventory-stock";
import { roundMoney } from "@/lib/money";
import { AccountTransaction } from "@/models/AccountTransaction";
import { FinancialAccount } from "@/models/FinancialAccount";

export type LedgerPostInput = {
  accountId: Types.ObjectId | string;
  entryType: AccountTransactionType;
  entryDate?: Date;
  description: string;
  debit?: number;
  credit?: number;
  referenceType: AccountTransactionReferenceType;
  referenceId?: Types.ObjectId | string | null;
  referenceNumber?: string;
  idempotencyKey: string;
};

async function allocateTxnNumber(
  businessId: Types.ObjectId,
  session?: ClientSession,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await nextDailySequence(async (prefix) => {
        const query = AccountTransaction.countDocuments({
          businessId,
          transactionNumber: { $regex: `^${prefix}` },
        });
        if (session) query.session(session);
        return query;
      }, "ATX");
    } catch (error) {
      const pattern = duplicateKeyPattern(error);
      if (pattern && "transactionNumber" in pattern && attempt < 4) continue;
      throw error;
    }
  }
  throw new AccountsError("Could not allocate a transaction number.", 500);
}

const DEFAULT_ACCOUNTS: Array<{
  name: string;
  accountType: "CASH" | "BANK" | "UPI";
  linkedPaymentMethod: TenderMethod;
  isDefault: boolean;
}> = [
  {
    name: "Cash in Hand",
    accountType: "CASH",
    linkedPaymentMethod: "CASH",
    isDefault: true,
  },
  {
    name: "Bank Account",
    accountType: "BANK",
    linkedPaymentMethod: "BANK_TRANSFER",
    isDefault: true,
  },
  {
    name: "UPI Account",
    accountType: "UPI",
    linkedPaymentMethod: "UPI",
    isDefault: true,
  },
  {
    name: "Card Collections",
    accountType: "BANK",
    linkedPaymentMethod: "CARD",
    isDefault: true,
  },
];

/**
 * Keep a single active account per linked payment method.
 * Prefer the oldest row that already has a non-zero balance / isDefault.
 */
export async function dedupeDefaultAccounts(
  businessId: Types.ObjectId,
  session?: ClientSession,
) {
  for (const row of DEFAULT_ACCOUNTS) {
    const query = FinancialAccount.find({
      businessId,
      linkedPaymentMethod: row.linkedPaymentMethod,
      isActive: true,
    }).sort({ isDefault: -1, createdAt: 1 });
    if (session) query.session(session);
    const duplicates = await query;
    if (duplicates.length <= 1) continue;

    const keeper =
      duplicates.find((account) => account.currentBalance !== 0) ??
      duplicates[0];

    for (const account of duplicates) {
      if (String(account._id) === String(keeper._id)) continue;
      if (account.currentBalance !== 0) {
        // Preserve funds: fold balance into keeper via a transfer-style adjust.
        keeper.currentBalance = roundMoney(
          keeper.currentBalance + account.currentBalance,
        );
        account.currentBalance = 0;
      }
      account.isActive = false;
      account.notes = [account.notes, "Deactivated duplicate default account"]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 500);
      await account.save(session ? { session } : undefined);
    }
    if (!keeper.isDefault) keeper.isDefault = true;
    await keeper.save(session ? { session } : undefined);
  }
}

export async function ensureDefaultAccounts(scope: StockScope, session?: ClientSession) {
  await dedupeDefaultAccounts(scope.businessId, session);

  for (const row of DEFAULT_ACCOUNTS) {
    const existingQuery = FinancialAccount.findOne({
      businessId: scope.businessId,
      linkedPaymentMethod: row.linkedPaymentMethod,
      isActive: true,
    });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;
    if (existing) continue;

    try {
      await FinancialAccount.create(
        [
          {
            businessId: scope.businessId,
            storeId: scope.storeId,
            name: row.name,
            accountType: row.accountType,
            linkedPaymentMethod: row.linkedPaymentMethod,
            openingBalance: 0,
            currentBalance: 0,
            allowNegative: false,
            isDefault: row.isDefault,
            isActive: true,
            notes: "System default account",
          },
        ],
        session ? { session } : undefined,
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: number }).code === 11000
      ) {
        // Concurrent create — another request already inserted this default.
        continue;
      }
      throw error;
    }
  }
}

export async function resolveAccountForPaymentMethod(
  scope: StockScope,
  method: TenderMethod,
  session?: ClientSession,
) {
  await ensureDefaultAccounts(scope, session);
  const query = FinancialAccount.findOne({
    businessId: scope.businessId,
    linkedPaymentMethod: method,
    isActive: true,
  });
  if (session) query.session(session);
  const account = await query;
  if (!account) {
    throw new AccountsError(
      `No active account is linked to payment method ${method}.`,
      409,
      "ACCOUNT_MISSING",
    );
  }
  return account;
}

async function applyBalanceChange(params: {
  accountId: Types.ObjectId;
  businessId: Types.ObjectId;
  delta: number;
  session: ClientSession;
  allowNegativeFallback?: boolean;
}) {
  const account = await FinancialAccount.findOne({
    _id: params.accountId,
    businessId: params.businessId,
  }).session(params.session);

  if (!account || !account.isActive) {
    throw new AccountsError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  }

  const next = roundMoney(account.currentBalance + params.delta);
  if (next < -0.001 && !account.allowNegative && !params.allowNegativeFallback) {
    throw new AccountsError(
      `"${account.name}" does not have enough balance for this transaction.`,
      409,
      "INSUFFICIENT_BALANCE",
    );
  }

  account.currentBalance = next;
  await account.save({ session: params.session });
  return account;
}

/**
 * Post an immutable cashbook entry and update the account balance.
 * Idempotent on (businessId, idempotencyKey).
 */
export async function postAccountTransaction(params: {
  scope: StockScope;
  input: LedgerPostInput;
  session?: ClientSession;
}) {
  const debit = roundMoney(params.input.debit ?? 0);
  const credit = roundMoney(params.input.credit ?? 0);
  if ((debit <= 0 && credit <= 0) || (debit > 0 && credit > 0)) {
    throw new AccountsError(
      "Each ledger entry must be either a debit or a credit, not both.",
    );
  }

  const existing = await AccountTransaction.findOne({
    businessId: params.scope.businessId,
    idempotencyKey: params.input.idempotencyKey,
  }).lean();
  if (existing) return existing;

  const run = async (session: ClientSession) => {
    const replay = await AccountTransaction.findOne({
      businessId: params.scope.businessId,
      idempotencyKey: params.input.idempotencyKey,
    }).session(session);
    if (replay) return replay.toObject();

    const accountId = new Types.ObjectId(String(params.input.accountId));
    const delta = debit - credit;
    await applyBalanceChange({
      accountId,
      businessId: params.scope.businessId,
      delta,
      session,
    });

    const transactionNumber = await allocateTxnNumber(
      params.scope.businessId,
      session,
    );

    const [created] = await AccountTransaction.create(
      [
        {
          businessId: params.scope.businessId,
          storeId: params.scope.storeId,
          accountId,
          transactionNumber,
          entryType: params.input.entryType,
          entryDate: params.input.entryDate ?? new Date(),
          description: params.input.description,
          debit,
          credit,
          referenceType: params.input.referenceType,
          referenceId: params.input.referenceId
            ? new Types.ObjectId(String(params.input.referenceId))
            : null,
          referenceNumber: params.input.referenceNumber ?? "",
          idempotencyKey: params.input.idempotencyKey,
          createdBy: params.scope.performedBy ?? null,
        },
      ],
      { session },
    );

    return created.toObject();
  };

  if (params.session) {
    return run(params.session);
  }
  return withMongoTransaction((session) => run(session));
}

export async function postSaleCollections(params: {
  scope: StockScope;
  saleId: Types.ObjectId | string;
  saleNumber: string;
  payments: Array<{
    _id?: Types.ObjectId;
    paymentMethod: string;
    amount: number;
    status: string;
    sequence: number;
  }>;
  session: ClientSession;
}) {
  for (const payment of params.payments) {
    if (payment.status === "CREDIT") continue;
    if (payment.amount <= 0) continue;
    if (
      payment.paymentMethod !== "CASH" &&
      payment.paymentMethod !== "UPI" &&
      payment.paymentMethod !== "CARD" &&
      payment.paymentMethod !== "BANK_TRANSFER"
    ) {
      continue;
    }

    const account = await resolveAccountForPaymentMethod(
      params.scope,
      payment.paymentMethod,
      params.session,
    );

    const key = payment._id
      ? `sale-pay:${payment._id}`
      : `sale-pay:${params.saleId}:${payment.sequence}`;

    await postAccountTransaction({
      scope: params.scope,
      session: params.session,
      input: {
        accountId: account._id,
        entryType: "SALE_COLLECTION",
        description: `Sale collection ${params.saleNumber} (${payment.paymentMethod})`,
        debit: payment.amount,
        referenceType: "PAYMENT",
        referenceId: payment._id ?? params.saleId,
        referenceNumber: params.saleNumber,
        idempotencyKey: key,
      },
    });
  }
}

export async function postSupplierPaymentToLedger(params: {
  scope: StockScope;
  supplierPaymentId: Types.ObjectId | string;
  paymentNumber: string;
  amount: number;
  paymentMethod: string;
  accountId?: Types.ObjectId | string | null;
  session: ClientSession;
}) {
  const method =
    params.paymentMethod === "CHEQUE" ? "BANK_TRANSFER" : params.paymentMethod;

  let accountId = params.accountId;
  if (!accountId) {
    if (
      method !== "CASH" &&
      method !== "UPI" &&
      method !== "BANK_TRANSFER" &&
      method !== "CARD"
    ) {
      return null;
    }
    const account = await resolveAccountForPaymentMethod(
      params.scope,
      method as TenderMethod,
      params.session,
    );
    accountId = account._id;
  }

  return postAccountTransaction({
    scope: params.scope,
    session: params.session,
    input: {
      accountId,
      entryType: "SUPPLIER_PAYMENT",
      description: `Supplier payment ${params.paymentNumber}`,
      credit: params.amount,
      referenceType: "SUPPLIER_PAYMENT",
      referenceId: params.supplierPaymentId,
      referenceNumber: params.paymentNumber,
      idempotencyKey: `supplier-pay:${params.supplierPaymentId}`,
    },
  });
}

export async function listAccountLedger(params: {
  businessId: Types.ObjectId;
  accountId: string;
  page: number;
  limit: number;
  skip: number;
  from?: Date;
  to?: Date;
}) {
  const filter: Record<string, unknown> = {
    businessId: params.businessId,
    accountId: params.accountId,
  };
  if (params.from || params.to) {
    filter.entryDate = {
      ...(params.from ? { $gte: params.from } : {}),
      ...(params.to ? { $lte: params.to } : {}),
    };
  }

  const [total, rows, account] = await Promise.all([
    AccountTransaction.countDocuments(filter),
    AccountTransaction.find(filter)
      .sort({ entryDate: -1, createdAt: -1 })
      .skip(params.skip)
      .limit(params.limit)
      .lean(),
    FinancialAccount.findOne({
      _id: params.accountId,
      businessId: params.businessId,
    }).lean(),
  ]);

  if (!account) {
    throw new AccountsError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  }

  // Running balance from oldest → newest for the filtered window ending at current.
  const chronological = [...rows].reverse();
  // Approximate: start from currentBalance and walk newest→oldest for display.
  let cursor = account.currentBalance;
  const withRunning = rows.map((row) => {
    const balanceAfter = cursor;
    cursor = roundMoney(cursor - row.debit + row.credit);
    return {
      ...row,
      _id: String(row._id),
      accountId: String(row.accountId),
      runningBalance: balanceAfter,
    };
  });

  void chronological;

  return {
    account: {
      ...account,
      _id: String(account._id),
      businessId: String(account.businessId),
      storeId: String(account.storeId),
    },
    data: withRunning,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}
