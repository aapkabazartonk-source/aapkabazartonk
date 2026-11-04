import type { InvoiceType, SupplyType } from "@/lib/constants";
import { BillingError } from "@/lib/billing-error";
import { fromPaise, multiplyMoney, roundMoney, toPaise } from "@/lib/money";

/**
 * GST settings come from the business document and each product's gstRate.
 * Rates are never defaulted to a statutory slab inside this module.
 */
export type BusinessTaxSettings = {
  isGstRegistered: boolean;
  gstin: string;
  stateCode: string;
  pricesIncludeGst: boolean;
};

export type CatalogSaleLine = {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  hsn: string;
  quantity: number;
  /** Authoritative selling price loaded from the product record. */
  unitPrice: number;
  /** Authoritative product GST rate. Ignored when the business is not registered. */
  gstRate: number;
  itemDiscount: number;
};

export type CalculatedSaleLine = {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  unit: string;
  hsn: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  billDiscountShare: number;
  taxRate: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  taxAmount: number;
  finalAmount: number;
};

export type SaleTotals = {
  subtotal: number;
  itemDiscount: number;
  billDiscount: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
};

export type SaleCalculation = {
  invoiceType: InvoiceType;
  supplyType: SupplyType;
  pricesIncludeGst: boolean;
  lines: CalculatedSaleLine[];
  totals: SaleTotals;
};

function assertMoney(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) {
    throw new BillingError(`${label} cannot be negative.`);
  }
}

/**
 * Spread a bill discount across lines in paise so the shares sum exactly.
 */
export function allocateDiscountPaise(netPaise: number[], discountPaise: number) {
  const total = netPaise.reduce((sum, value) => sum + value, 0);
  const discount = Math.min(Math.max(0, discountPaise), total);
  if (discount === 0 || total === 0) return netPaise.map(() => 0);

  const raw = netPaise.map((net) => (net * discount) / total);
  const floors = raw.map((value) => Math.floor(value));
  let remainder = discount - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  const shares = [...floors];
  for (let cursor = 0; remainder > 0; cursor += 1) {
    shares[order[cursor % order.length].index] += 1;
    remainder -= 1;
  }
  return shares;
}

export function resolveSupplyType(
  businessStateCode: string,
  customerStateCode: string,
): SupplyType {
  if (!customerStateCode || !businessStateCode) return "INTRA";
  return customerStateCode === businessStateCode ? "INTRA" : "INTER";
}

export function resolveInvoiceType(
  isGstRegistered: boolean,
  lines: { taxRate: number }[],
): InvoiceType {
  if (!isGstRegistered) return "BILL_OF_SUPPLY";
  return lines.some((line) => line.taxRate > 0) ? "TAX_INVOICE" : "BILL_OF_SUPPLY";
}

function splitTax(taxPaise: number, supplyType: SupplyType) {
  if (taxPaise <= 0) return { cgst: 0, sgst: 0, igst: 0 };
  if (supplyType === "INTER") {
    return { cgst: 0, sgst: 0, igst: taxPaise };
  }
  const cgst = Math.round(taxPaise / 2);
  return { cgst, sgst: taxPaise - cgst, igst: 0 };
}

export function calculateSale(params: {
  settings: BusinessTaxSettings;
  customerStateCode?: string;
  lines: CatalogSaleLine[];
  billDiscount: number;
}): SaleCalculation {
  const { settings, lines, billDiscount } = params;
  if (lines.length === 0) {
    throw new BillingError("Add at least one product before billing.");
  }

  const seen = new Set<string>();
  const prepared = lines.map((line) => {
    if (seen.has(line.productId)) {
      throw new BillingError(
        "Each product can appear only once. Increase the quantity on the existing line.",
      );
    }
    seen.add(line.productId);

    assertMoney(line.quantity, "Quantity");
    if (line.quantity <= 0) {
      throw new BillingError("Quantity must be greater than 0.");
    }
    assertMoney(line.unitPrice, "Selling price");
    assertMoney(line.itemDiscount, "Item discount");
    if (!Number.isFinite(line.gstRate) || line.gstRate < 0 || line.gstRate > 100) {
      throw new BillingError(
        `GST rate for "${line.productName}" must be between 0 and 100.`,
      );
    }

    const gross = multiplyMoney(line.quantity, line.unitPrice);
    const discount = Math.min(gross, roundMoney(line.itemDiscount));
    if (roundMoney(line.itemDiscount) - discount > 0.001) {
      throw new BillingError(
        `Item discount on "${line.productName}" cannot exceed ${gross.toFixed(2)}.`,
      );
    }
    return {
      line,
      grossPaise: toPaise(gross),
      discountPaise: toPaise(discount),
      netPaise: toPaise(gross) - toPaise(discount),
    };
  });

  assertMoney(billDiscount, "Bill discount");
  const netTotal = prepared.reduce((sum, line) => sum + line.netPaise, 0);
  const requestedBill = toPaise(roundMoney(billDiscount));
  if (requestedBill > netTotal) {
    throw new BillingError(
      `Bill discount cannot exceed ${(netTotal / 100).toFixed(2)}.`,
    );
  }
  const shares = allocateDiscountPaise(
    prepared.map((line) => line.netPaise),
    requestedBill,
  );

  const applyTax = settings.isGstRegistered;
  if (applyTax) {
    if (!settings.gstin.trim()) {
      throw new BillingError(
        "Add the business GSTIN in Settings before billing a GST-registered store.",
        409,
        "GSTIN_REQUIRED",
      );
    }
    if (!settings.stateCode.trim()) {
      throw new BillingError(
        "Set the business state in Settings before billing a GST-registered store.",
        409,
        "STATE_REQUIRED",
      );
    }
  }

  const supplyType = resolveSupplyType(
    settings.stateCode.trim(),
    (params.customerStateCode ?? "").trim(),
  );

  const calculated: CalculatedSaleLine[] = prepared.map((entry, index) => {
    const rate = applyTax ? entry.line.gstRate : 0;
    const basePaise = entry.netPaise - shares[index];
    let taxablePaise = basePaise;
    let taxPaise = 0;

    if (rate > 0 && settings.pricesIncludeGst) {
      taxablePaise = Math.round((basePaise * 100) / (100 + rate));
      taxPaise = basePaise - taxablePaise;
    } else if (rate > 0) {
      taxablePaise = basePaise;
      taxPaise = Math.round((basePaise * rate) / 100);
    }

    const parts = splitTax(taxPaise, supplyType);
    const finalPaise = taxablePaise + taxPaise;

    return {
      productId: entry.line.productId,
      productName: entry.line.productName,
      sku: entry.line.sku,
      barcode: entry.line.barcode,
      unit: entry.line.unit,
      hsn: entry.line.hsn,
      quantity: entry.line.quantity,
      unitPrice: entry.line.unitPrice,
      discount: fromPaise(entry.discountPaise),
      billDiscountShare: fromPaise(shares[index]),
      taxRate: rate,
      taxableAmount: fromPaise(taxablePaise),
      cgst: fromPaise(parts.cgst),
      sgst: fromPaise(parts.sgst),
      igst: fromPaise(parts.igst),
      taxAmount: fromPaise(taxPaise),
      finalAmount: fromPaise(finalPaise),
    };
  });

  const sum = (pick: (line: CalculatedSaleLine) => number) =>
    calculated.reduce((total, line) => total + toPaise(pick(line)), 0);

  const totals: SaleTotals = {
    subtotal: fromPaise(prepared.reduce((total, line) => total + line.grossPaise, 0)),
    itemDiscount: fromPaise(
      prepared.reduce((total, line) => total + line.discountPaise, 0),
    ),
    billDiscount: fromPaise(requestedBill),
    taxableAmount: fromPaise(sum((line) => line.taxableAmount)),
    cgst: fromPaise(sum((line) => line.cgst)),
    sgst: fromPaise(sum((line) => line.sgst)),
    igst: fromPaise(sum((line) => line.igst)),
    totalTax: fromPaise(sum((line) => line.taxAmount)),
    grandTotal: fromPaise(sum((line) => line.finalAmount)),
  };

  return {
    invoiceType: resolveInvoiceType(settings.isGstRegistered, calculated),
    supplyType,
    pricesIncludeGst: settings.pricesIncludeGst,
    lines: calculated,
    totals,
  };
}
