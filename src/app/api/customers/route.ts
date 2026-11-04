import {
  escapeRegex,
  handleApiError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { requireTenant } from "@/lib/tenant";
import { customerCreateSchema } from "@/lib/validators/customer";
import { stateCodeFromGstin } from "@/lib/india-states";
import { Customer } from "@/models/Customer";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
      isActive: { $ne: false },
    };
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = [
        { name: { $regex: pattern, $options: "i" } },
        { phone: { $regex: pattern, $options: "i" } },
        { gstin: { $regex: pattern, $options: "i" } },
      ];
    }

    const [total, customers] = await Promise.all([
      Customer.countDocuments(filter),
      Customer.find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .select("name phone email address gstin stateCode")
        .lean(),
    ]);

    return jsonOk({
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = await request.json();
    const parsed = customerCreateSchema.parse(body);
    const stateCode = parsed.stateCode || stateCodeFromGstin(parsed.gstin);
    const customer = await Customer.create({
      businessId: tenant.businessId,
      name: parsed.name,
      phone: parsed.phone,
      email: parsed.email || undefined,
      address: parsed.address,
      gstin: parsed.gstin,
      stateCode,
      notes: parsed.notes,
      isActive: true,
    });
    return jsonOk({ data: customer.toObject() }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
