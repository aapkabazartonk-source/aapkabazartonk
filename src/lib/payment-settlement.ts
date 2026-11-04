import type {
  PaymentMethod,
  PaymentRecordStatus,
  PaymentVerification,
  SalePaymentStatus,
  TenderMethod,
} from "@/lib/constants";
import { BillingError } from "@/lib/billing-error";
import { fromPaise, roundMoney, toPaise } from "@/lib/money";

export type TenderInput = {
  method: TenderMethod;
  /** For cash this is the amount received when tenderedAmount is omitted. */
  amount: number;
  tenderedAmount?: number;
  referenceNumber?: string;
};

export type SettledPayment = {
  method: PaymentMethod;
  /** Amount applied to the bill. Cash change is excluded. */
  amount: number;
  tenderedAmount: number;
  changeGiven: number;
  referenceNumber: string;
  status: PaymentRecordStatus;
  verification: PaymentVerification;
};

export type PaymentSettlement = {
  amountPaid: number;
  balanceDue: number;
  changeGiven: number;
  paymentStatus: SalePaymentStatus;
  payments: SettledPayment[];
};

const METHOD_LABEL: Record<TenderMethod, string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

/**
 * Server-side payment math.
 * UPI, card, and bank transfer are manually confirmed. Nothing here is gateway-verified.
 * A remaining balance is recorded as credit (udhaar) only when allowCredit is set.
 */
export function settlePayments(
  grandTotal: number,
  tenders: TenderInput[],
  allowCredit: boolean,
): PaymentSettlement {
  if (!Number.isFinite(grandTotal) || grandTotal < 0) {
    throw new BillingError("Grand total cannot be negative.");
  }

  let remaining = toPaise(roundMoney(grandTotal));
  let paid = 0;
  let change = 0;
  const payments: SettledPayment[] = [];

  for (const tender of tenders) {
    const referenceNumber = (tender.referenceNumber ?? "").trim();
    if (tender.method === "CASH") {
      const tendered = toPaise(
        roundMoney(tender.tenderedAmount ?? tender.amount),
      );
      if (tendered <= 0) {
        throw new BillingError("Cash received must be greater than 0.");
      }
      const applied = Math.min(tendered, remaining);
      if (applied <= 0) {
        throw new BillingError("Cash received exceeds the amount still due.");
      }
      const lineChange = tendered - applied;
      payments.push({
        method: "CASH",
        amount: fromPaise(applied),
        tenderedAmount: fromPaise(tendered),
        changeGiven: fromPaise(lineChange),
        referenceNumber,
        status: "CONFIRMED",
        verification: "NOT_APPLICABLE",
      });
      paid += applied;
      change += lineChange;
      remaining -= applied;
      continue;
    }

    const amount = toPaise(roundMoney(tender.amount));
    const label = METHOD_LABEL[tender.method];
    if (amount <= 0) {
      throw new BillingError(`${label} amount must be greater than 0.`);
    }
    if (amount > remaining) {
      throw new BillingError(
        `${label} amount exceeds the balance still due. Split the payment or reduce this amount.`,
      );
    }
    payments.push({
      method: tender.method,
      amount: fromPaise(amount),
      tenderedAmount: fromPaise(amount),
      changeGiven: 0,
      referenceNumber,
      status: tender.method === "UPI" ? "MANUALLY_CONFIRMED" : "CONFIRMED",
      verification: "MANUAL",
    });
    paid += amount;
    remaining -= amount;
  }

  if (remaining > 0 && !allowCredit) {
    throw new BillingError(
      `Amount received is short by ₹${fromPaise(remaining).toFixed(2)}. Collect the balance or put the remainder on udhaar.`,
      400,
      "BALANCE_DUE",
    );
  }

  if (remaining > 0) {
    payments.push({
      method: "CREDIT",
      amount: fromPaise(remaining),
      tenderedAmount: 0,
      changeGiven: 0,
      referenceNumber: "",
      status: "CREDIT",
      verification: "NOT_APPLICABLE",
    });
  }

  const amountPaid = fromPaise(paid);
  const balanceDue = fromPaise(remaining);
  let paymentStatus: SalePaymentStatus = "PAID";
  if (balanceDue > 0 && amountPaid > 0) paymentStatus = "PARTIAL";
  else if (balanceDue > 0) paymentStatus = "UNPAID";

  return {
    amountPaid,
    balanceDue,
    changeGiven: fromPaise(change),
    paymentStatus,
    payments,
  };
}
