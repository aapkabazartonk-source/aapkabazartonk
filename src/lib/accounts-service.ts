import { Types } from "mongoose";
import {
  ensureDefaultAccounts,
  postAccountTransaction,
} from "@/lib/account-ledger";
import { AccountsError } from "@/lib/accounts-error";
import {
  type FinancialAccountType,
  type TenderMethod,
} from "@/lib/constants";
import { withMongoTransaction, type StockScope } from "@/lib/inventory-stock";
import { roundMoney } from "@/lib/money";
import { FinancialAccount } from "@/models/FinancialAccount";

export async function listAccounts(scope: StockScope) {
  await ensureDefaultAccounts(scope);
  const rows = await FinancialAccount.find({
    businessId: scope.businessId,
  })
    .sort({ isActive: -1, accountType: 1, name: 1 })
    .lean();
  return rows.map((row) => ({
    ...row,
    _id: String(row._id),
    businessId: String(row.businessId),
    storeId: String(row.storeId),
  }));
}

export async function createAccount(params: {
  scope: StockScope;
  data: {
    name: string;
    accountType: FinancialAccountType;
    linkedPaymentMethod?: TenderMethod | null;
    openingBalance?: number;
    allowNegative?: boolean;
    notes?: string;
  };
}) {
  const opening = roundMoney(params.data.openingBalance ?? 0);
  return withMongoTransaction(async (session) => {
    const [account] = await FinancialAccount.create(
      [
        {
          businessId: params.scope.businessId,
          storeId: params.scope.storeId,
          name: params.data.name.trim(),
          accountType: params.data.accountType,
          linkedPaymentMethod: params.data.linkedPaymentMethod ?? null,
          openingBalance: opening,
          // Balance is applied only through the opening ledger entry below.
          currentBalance: 0,
          allowNegative: params.data.allowNegative ?? false,
          isDefault: false,
          isActive: true,
          notes: (params.data.notes ?? "").trim(),
        },
      ],
      { session },
    );

    if (opening !== 0) {
      await postAccountTransaction({
        scope: params.scope,
        session,
        input: {
          accountId: account._id,
          entryType: "OPENING",
          description: `Opening balance for ${account.name}`,
          debit: opening > 0 ? opening : 0,
          credit: opening < 0 ? Math.abs(opening) : 0,
          referenceType: "ACCOUNT",
          referenceId: account._id,
          referenceNumber: account.name,
          idempotencyKey: `opening:${account._id}`,
        },
      });
    }

    const refreshed = await FinancialAccount.findById(account._id).session(
      session,
    );
    return refreshed ?? account;
  });
}

export async function updateAccount(params: {
  scope: StockScope;
  accountId: string;
  data: Partial<{
    name: string;
    linkedPaymentMethod: TenderMethod | null;
    allowNegative: boolean;
    isActive: boolean;
    notes: string;
  }>;
}) {
  const account = await FinancialAccount.findOne({
    _id: params.accountId,
    businessId: params.scope.businessId,
  });
  if (!account) throw new AccountsError("Account not found.", 404);
  if (params.data.name !== undefined) account.name = params.data.name.trim();
  if (params.data.linkedPaymentMethod !== undefined) {
    account.linkedPaymentMethod = params.data.linkedPaymentMethod;
  }
  if (params.data.allowNegative !== undefined) {
    account.allowNegative = params.data.allowNegative;
  }
  if (params.data.isActive !== undefined) account.isActive = params.data.isActive;
  if (params.data.notes !== undefined) account.notes = params.data.notes.trim();
  await account.save();
  return account;
}

export async function recordManualMovement(params: {
  scope: StockScope;
  data: {
    accountId: string;
    kind: "DEPOSIT" | "WITHDRAWAL";
    amount: number;
    entryDate?: string | Date;
    description?: string;
    idempotencyKey: string;
  };
}) {
  const amount = roundMoney(params.data.amount);
  if (amount <= 0) throw new AccountsError("Amount must be greater than 0.");

  return postAccountTransaction({
    scope: params.scope,
    input: {
      accountId: params.data.accountId,
      entryType: params.data.kind === "DEPOSIT" ? "DEPOSIT" : "WITHDRAWAL",
      entryDate: params.data.entryDate
        ? new Date(params.data.entryDate)
        : new Date(),
      description:
        (params.data.description ?? "").trim() ||
        (params.data.kind === "DEPOSIT" ? "Deposit" : "Withdrawal"),
      debit: params.data.kind === "DEPOSIT" ? amount : 0,
      credit: params.data.kind === "WITHDRAWAL" ? amount : 0,
      referenceType: "MANUAL",
      referenceNumber: "",
      idempotencyKey: params.data.idempotencyKey,
    },
  });
}

export async function transferBetweenAccounts(params: {
  scope: StockScope;
  data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    entryDate?: string | Date;
    description?: string;
    idempotencyKey: string;
  };
}) {
  const amount = roundMoney(params.data.amount);
  if (amount <= 0) throw new AccountsError("Amount must be greater than 0.");
  if (params.data.fromAccountId === params.data.toAccountId) {
    throw new AccountsError("Choose two different accounts for a transfer.");
  }

  return withMongoTransaction(async (session) => {
    const transferId = new Types.ObjectId();
    const entryDate = params.data.entryDate
      ? new Date(params.data.entryDate)
      : new Date();
    const description =
      (params.data.description ?? "").trim() || "Account transfer";

    await postAccountTransaction({
      scope: params.scope,
      session,
      input: {
        accountId: params.data.fromAccountId,
        entryType: "TRANSFER_OUT",
        entryDate,
        description,
        credit: amount,
        referenceType: "TRANSFER",
        referenceId: transferId,
        referenceNumber: String(transferId),
        idempotencyKey: `${params.data.idempotencyKey}:out`,
      },
    });

    await postAccountTransaction({
      scope: params.scope,
      session,
      input: {
        accountId: params.data.toAccountId,
        entryType: "TRANSFER_IN",
        entryDate,
        description,
        debit: amount,
        referenceType: "TRANSFER",
        referenceId: transferId,
        referenceNumber: String(transferId),
        idempotencyKey: `${params.data.idempotencyKey}:in`,
      },
    });

    return { transferId: String(transferId), amount };
  });
}

export async function recordOwnerWithdrawal(params: {
  scope: StockScope;
  data: {
    accountId: string;
    amount: number;
    entryDate?: string | Date;
    paymentMethod?: string;
    description?: string;
    idempotencyKey: string;
  };
}) {
  const amount = roundMoney(params.data.amount);
  if (amount <= 0) throw new AccountsError("Amount must be greater than 0.");

  return postAccountTransaction({
    scope: params.scope,
    input: {
      accountId: params.data.accountId,
      entryType: "OWNER_WITHDRAWAL",
      entryDate: params.data.entryDate
        ? new Date(params.data.entryDate)
        : new Date(),
      description:
        (params.data.description ?? "").trim() ||
        "Owner withdrawal (drawings)",
      credit: amount,
      referenceType: "OWNER_WITHDRAWAL",
      referenceNumber: params.data.paymentMethod ?? "",
      idempotencyKey: params.data.idempotencyKey,
    },
  });
}

export async function accountBalances(businessId: Types.ObjectId) {
  const rows = await FinancialAccount.find({
    businessId,
    isActive: true,
  }).lean();

  let cashInHand = 0;
  let bankBalance = 0;
  let upiBalance = 0;
  let total = 0;

  for (const row of rows) {
    total = roundMoney(total + row.currentBalance);
    if (row.accountType === "CASH") {
      cashInHand = roundMoney(cashInHand + row.currentBalance);
    } else if (row.accountType === "BANK") {
      bankBalance = roundMoney(bankBalance + row.currentBalance);
    } else if (row.accountType === "UPI") {
      upiBalance = roundMoney(upiBalance + row.currentBalance);
    }
  }

  return { cashInHand, bankBalance, upiBalance, total, accounts: rows };
}
