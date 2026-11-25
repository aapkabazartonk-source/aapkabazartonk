import { handleApiError, jsonOk } from "@/lib/api";
import { SALARY_PAYMENT_METHODS } from "@/lib/constants";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { paySalary } from "@/lib/staff-salary-service";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const schema = z.object({
  staffId: z.string().trim().min(1),
  salaryRecordId: z.string().trim().optional().nullable(),
  paymentKind: z.enum(["REGULAR", "ADVANCE", "BONUS"]),
  amount: z.coerce.number().positive(),
  paymentMethod: z.enum(SALARY_PAYMENT_METHODS),
  accountId: z.string().trim().min(1),
  paymentDate: z.string().optional(),
  notes: z.string().trim().max(500).optional().default(""),
  idempotencyKey: z.string().trim().min(8).max(80),
});

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = schema.parse(await request.json());
    const payment = await paySalary({
      scope: scopeFromTenant(tenant),
      data: body,
    });
    return jsonOk({ data: { _id: String(payment._id) } }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
