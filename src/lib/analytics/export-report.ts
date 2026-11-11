import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalyticsExportBundle } from "@/lib/analytics/service";
import type { ComparedNumber } from "@/lib/analytics/types";

function csvCell(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
  if (/[",\r\n]/.test(guarded)) return `"${guarded.replace(/"/g, '""')}"`;
  return guarded;
}

function csvLine(values: Array<string | number | null | undefined>) {
  return values.map(csvCell).join(",");
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return value.toFixed(2);
}

function metricCells(metric: ComparedNumber) {
  return [
    money(metric.current),
    metric.comparable ? money(metric.previous) : "",
    metric.delta === null ? "" : money(metric.delta),
    metric.percent === null ? "" : metric.percent.toFixed(2),
  ];
}

export function buildAnalyticsCsv(bundle: AnalyticsExportBundle) {
  const { overview, categories, payments, profit, products, purchases } = bundle;
  const lines = [
    csvLine(["Report", "Business Analytics"]),
    csvLine(["Business", bundle.businessName]),
    csvLine(["Date range", overview.range.label]),
    csvLine(["Previous range", overview.previousRange.label]),
    csvLine(["Generated", overview.generatedAt]),
    csvLine(["Timezone", overview.timezone]),
    csvLine(["Row cap", bundle.rowCap]),
    "",
    csvLine(["KPI", "Current", "Previous", "Change", "Change %"]),
    csvLine(["Total revenue", ...metricCells(overview.kpis.revenue)]),
    csvLine(["Net sales", ...metricCells(overview.kpis.netSales)]),
    csvLine(["Cash collected", ...metricCells(overview.kpis.collected)]),
    csvLine(["Gross profit", ...metricCells(overview.kpis.grossProfit)]),
    csvLine(["Gross profit margin %", ...metricCells(overview.kpis.grossMargin)]),
    csvLine(["Total bills", ...metricCells(overview.kpis.bills)]),
    csvLine(["Average bill value", ...metricCells(overview.kpis.averageBill)]),
    csvLine(["Units sold", ...metricCells(overview.kpis.unitsSold)]),
    csvLine(["Total purchases", ...metricCells(overview.kpis.purchases)]),
    csvLine(["Inventory valuation", money(overview.kpis.inventoryValue.current), "", "", ""]),
    csvLine(["Outstanding supplier payables", money(overview.kpis.payables.current), "", "", ""]),
    csvLine(["Cost status", overview.kpis.costStatus]),
    csvLine(["Cost note", overview.kpis.costNote]),
    csvLine(["Valuation", overview.valuationLabel]),
    csvLine(["Payables note", overview.payablesNote]),
    csvLine(["Returns", overview.returnsNote]),
    csvLine(["Expenses", profit.expensesNote]),
    csvLine(["Net profit", ""]),
    csvLine(["GST", money(profit.gst)]),
    csvLine(["COGS", money(profit.cogs)]),
    "",
    csvLine(["Category", "Revenue", "Units", "Share %"]),
    ...categories.categories.map((category) =>
      csvLine([
        category.name,
        money(category.revenue),
        category.units,
        category.share === null ? "" : category.share.toFixed(2),
      ]),
    ),
    "",
    csvLine(["Payment method", "Amount", "Share %"]),
    ...payments.methods.map((method) =>
      csvLine([
        method.label,
        money(method.amount),
        method.percent === null ? "" : method.percent.toFixed(2),
      ]),
    ),
    csvLine(["Credit outstanding", money(payments.creditOutstanding)]),
    "",
    csvLine([
      "Product",
      "SKU",
      "Category",
      "Quantity",
      "Revenue",
      "Gross profit",
    ]),
    ...products.rows.map((row) =>
      csvLine([
        row.name,
        row.sku,
        row.category,
        row.quantity,
        money(row.revenue),
        money(row.grossProfit),
      ]),
    ),
    "",
    csvLine(["Supplier", "Purchase value", "Quantity"]),
    ...purchases.suppliers.map((supplier) =>
      csvLine([supplier.name, money(supplier.total), supplier.quantity]),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function buildAnalyticsPdf(bundle: AnalyticsExportBundle) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const margin = 40;
  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const maxWidth = pageWidth - margin * 2;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const ensure = (height: number) => {
    if (y - height >= margin) return;
    page = doc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const write = (text: string, size: number, weight: "regular" | "bold" = "regular") => {
    const face = weight === "bold" ? bold : font;
    const words = text.split(/\s+/);
    let line = "";
    const flush = () => {
      if (!line) return;
      ensure(size + 4);
      page.drawText(line, {
        x: margin,
        y,
        size,
        font: face,
        color: rgb(0.15, 0.17, 0.14),
      });
      y -= size + 4;
      line = "";
    };
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) > maxWidth && line) {
        flush();
        line = word;
      } else {
        line = next;
      }
    }
    flush();
  };

  const gap = (amount = 10) => {
    y -= amount;
  };

  write("Business Analytics", 18, "bold");
  write(bundle.businessName, 12, "bold");
  write(`Date range: ${bundle.overview.range.label}`, 10);
  write(`Previous range: ${bundle.overview.previousRange.label}`, 10);
  write(`Generated: ${bundle.overview.generatedAt}`, 10);
  write(`Timezone: ${bundle.overview.timezone}`, 10);
  gap();
  write("KPI summary", 13, "bold");
  const kpis: Array<[string, ComparedNumber]> = [
    ["Total revenue", bundle.overview.kpis.revenue],
    ["Net sales", bundle.overview.kpis.netSales],
    ["Cash collected", bundle.overview.kpis.collected],
    ["Gross profit", bundle.overview.kpis.grossProfit],
    ["Gross margin %", bundle.overview.kpis.grossMargin],
    ["Total bills", bundle.overview.kpis.bills],
    ["Average bill", bundle.overview.kpis.averageBill],
    ["Units sold", bundle.overview.kpis.unitsSold],
    ["Total purchases", bundle.overview.kpis.purchases],
  ];
  for (const [label, metric] of kpis) {
    const current = metric.current === null ? "Unavailable" : metric.current.toFixed(2);
    const change =
      metric.percent === null
        ? "—"
        : `${metric.percent > 0 ? "+" : ""}${metric.percent.toFixed(2)}%`;
    write(`${label}: ${current} (${change})`, 10);
  }
  write(
    `Inventory valuation: ${bundle.overview.kpis.inventoryValue.current?.toFixed(2) ?? ""}`,
    10,
  );
  write(bundle.overview.valuationLabel, 9);
  write(
    `Outstanding supplier payables: ${bundle.overview.kpis.payables.current?.toFixed(2) ?? ""}`,
    10,
  );
  write(bundle.overview.payablesNote, 9);
  write(bundle.profit.costNote, 9);
  write(bundle.profit.expensesNote, 9);
  write("Net profit: unavailable until expenses are recorded.", 10);
  write(bundle.profit.returnsNote, 9);
  gap();
  write("Categories", 13, "bold");
  if (bundle.categories.categories.length === 0) write("No completed sales in this range.", 10);
  for (const category of bundle.categories.categories) {
    write(
      `${category.name}: ${category.revenue.toFixed(2)} · ${category.units} units · ${category.share ?? 0}%`,
      10,
    );
  }
  gap();
  write("Payments collected", 13, "bold");
  if (bundle.payments.methods.length === 0) write("No collected payments in this range.", 10);
  for (const method of bundle.payments.methods) {
    write(`${method.label}: ${method.amount.toFixed(2)} (${method.percent ?? 0}%)`, 10);
  }
  write(`Credit outstanding: ${bundle.payments.creditOutstanding.toFixed(2)}`, 10);
  gap();
  write("Products by revenue", 13, "bold");
  write(`Showing up to ${bundle.rowCap} rows.`, 9);
  if (bundle.products.rows.length === 0) write("No completed sales in this range.", 10);
  for (const row of bundle.products.rows) {
    const profit = row.grossProfit === null ? "n/a" : row.grossProfit.toFixed(2);
    write(
      `${row.name} (${row.sku}) · ${row.category} · qty ${row.quantity} · ${row.revenue.toFixed(2)} · profit ${profit}`,
      9,
    );
  }
  gap();
  write("Suppliers", 13, "bold");
  if (bundle.purchases.suppliers.length === 0) {
    write("No received purchases in this range.", 10);
  }
  for (const supplier of bundle.purchases.suppliers) {
    write(`${supplier.name}: ${supplier.total.toFixed(2)} · qty ${supplier.quantity}`, 10);
  }

  return doc.save();
}
