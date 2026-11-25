import { handleApiError, jsonOk } from "@/lib/api";
import { createAccount, listAccounts } from "@/lib/accounts-service";
import { FINANCIAL_ACCOUNT_TYPES, TENDER_METHODS } from "@/lib/constants";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { requireTenant } from "@/lib/tenant";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  accountType: z.enum(FINANCIAL_ACCOUNT_TYPES),
  linkedPaymentMethod: z.enum(TENDER_METHODS).nullable().optional(),
  openingBalance: z.coerce.number().optional().default(0),
  allowNegative: z.boolean().optional().default(false),
  notes: z.string().trim().max(500).optional().default(""),
});

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const data = await listAccounts(scopeFromTenant(tenant));
    return jsonOk({ data });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = createSchema.parse(await request.json());
    const account = await createAccount({
      scope: scopeFromTenant(tenant),
      data: body,
    });
    return jsonOk(
      {
        data: {
          ...account.toObject(),
          _id: String(account._id),
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
