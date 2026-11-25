import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { SALARY_PAYMENT_METHODS } from "@/lib/constants";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { updateStaff } from "@/lib/staff-salary-service";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  designation: z.string().trim().max(120).optional(),
  joiningDate: z.string().optional(),
  monthlySalary: z.coerce.number().min(0).optional(),
  paymentPreference: z.enum(SALARY_PAYMENT_METHODS).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;
    if (!isValidObjectId(id)) return jsonError("Invalid staff ID.", 400);
    const body = updateSchema.parse(await request.json());
    const staff = await updateStaff({
      scope: scopeFromTenant(tenant),
      staffId: id,
      data: body,
    });
    return jsonOk({
      data: {
        ...staff.toObject(),
        _id: String(staff._id),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
