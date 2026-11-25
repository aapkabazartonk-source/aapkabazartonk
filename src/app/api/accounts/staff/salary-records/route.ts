import { handleApiError, jsonOk } from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { createSalaryRecord } from "@/lib/staff-salary-service";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  staffId: z.string().trim().min(1),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  bonus: z.coerce.number().min(0).optional().default(0),
  deductions: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().max(1000).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = schema.parse(await request.json());
    const record = await createSalaryRecord({
      scope: scopeFromTenant(tenant),
      data: body,
    });
    return jsonOk(
      {
        data: {
          ...record.toObject(),
          _id: String(record._id),
          staffId: String(record.staffId),
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
