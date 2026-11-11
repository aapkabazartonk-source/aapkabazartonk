import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { buildAnalyticsCsv, buildAnalyticsPdf } from "@/lib/analytics/export-report";
import { readAnalyticsRequest } from "@/lib/analytics/http";
import { AnalyticsError } from "@/lib/analytics/query";
import { getExportBundle } from "@/lib/analytics/service";

export async function GET(request: Request) {
  try {
    const { scope, query } = await readAnalyticsRequest(request);
    if (query.format !== "csv" && query.format !== "pdf") {
      throw new AnalyticsError("Choose a CSV or PDF export.");
    }
    const bundle = await getExportBundle(scope, query);
    const stamp = query.range.from.toISOString().slice(0, 10);
    if (query.format === "csv") {
      return new NextResponse(buildAnalyticsCsv(bundle), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="business-analytics-${stamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const pdf = await buildAnalyticsPdf(bundle);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="business-analytics-${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
