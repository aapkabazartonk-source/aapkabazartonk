import { NextResponse } from "next/server";
import { handleApiError, isValidObjectId, jsonError, jsonOk } from "@/lib/api";
import { getSaleBundle } from "@/lib/billing-service";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { requireTenant } from "@/lib/tenant";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid invoice.", 400);

    const bundle = await getSaleBundle(tenant.businessId, id);
    if (!bundle) return jsonError("Invoice not found.", 404);

    const format = new URL(request.url).searchParams.get("format");
    if (format === "pdf") {
      const bytes = await renderInvoicePdf({
        ...bundle.sale,
        createdAt: bundle.sale.createdAt,
        payments: bundle.payments,
      });
      return new NextResponse(Buffer.from(bytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${bundle.sale.invoiceNumber}.pdf"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    return jsonOk({ data: bundle });
  } catch (error) {
    return handleApiError(error);
  }
}
