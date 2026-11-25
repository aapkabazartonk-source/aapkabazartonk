import { handleApiError, jsonOk } from "@/lib/api";
import { SALARY_PAYMENT_METHODS } from "@/lib/constants";
import { scopeFromTenant } from "@/lib/inventory-stock";
import {
  createStaff,
  staffSalaryStats,
} from "@/lib/staff-salary-service";
import { requireTenant } from "@/lib/tenant";
import { SalaryRecord } from "@/models/SalaryRecord";
import { Staff } from "@/models/Staff";
import { StaffAdvance } from "@/models/StaffAdvance";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().default(""),
  designation: z.string().trim().max(120).optional().default(""),
  joiningDate: z.string().min(1),
  monthlySalary: z.coerce.number().min(0),
  paymentPreference: z.enum(SALARY_PAYMENT_METHODS).optional(),
  notes: z.string().trim().max(1000).optional().default(""),
});

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const period =
      searchParams.get("period") ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const [staff, salaryRecords, advances, stats] = await Promise.all([
      Staff.find({ businessId: tenant.businessId })
        .sort({ isActive: -1, name: 1 })
        .lean(),
      SalaryRecord.find({
        businessId: tenant.businessId,
        $or: [{ period }, { status: { $in: ["UNPAID", "PARTIAL"] } }],
      })
        .sort({ period: -1 })
        .lean(),
      StaffAdvance.find({ businessId: tenant.businessId }).lean(),
      staffSalaryStats(tenant.businessId, period),
    ]);

    const advanceByStaff = new Map(
      advances.map((row) => [String(row.staffId), row.balance]),
    );

    return jsonOk({
      data: staff.map((row) => ({
        ...row,
        _id: String(row._id),
        joiningDate: row.joiningDate.toISOString(),
        advanceBalance: advanceByStaff.get(String(row._id)) ?? 0,
      })),
      salaryRecords: salaryRecords.map((row) => ({
        ...row,
        _id: String(row._id),
        staffId: String(row.staffId),
      })),
      stats,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = createSchema.parse(await request.json());
    const staff = await createStaff({
      scope: scopeFromTenant(tenant),
      data: body,
    });
    return jsonOk(
      {
        data: {
          ...staff.toObject(),
          _id: String(staff._id),
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
