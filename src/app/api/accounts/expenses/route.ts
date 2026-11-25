import {
  escapeRegex,
  handleApiError,
  jsonOk,
  parsePagination,
} from "@/lib/api";
import { EXPENSE_PAYMENT_METHODS, EXPENSE_PAYMENT_STATUSES } from "@/lib/constants";
import { createExpense } from "@/lib/expense-service";
import { scopeFromTenant } from "@/lib/inventory-stock";
import { roundMoney } from "@/lib/money";
import { requireTenant } from "@/lib/tenant";
import { Expense } from "@/models/Expense";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  categoryId: z.string().trim().min(1),
  amount: z.coerce.number().positive(),
  expenseDate: z.string().min(1),
  paymentDate: z.string().optional().nullable(),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS).optional().nullable(),
  accountId: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().default(""),
  attachmentUrl: z.string().trim().optional().default(""),
  payNowAmount: z.coerce.number().min(0).optional(),
  idempotencyKey: z.string().trim().min(8).max(80).optional(),
});

export async function GET(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams);
    const search = (searchParams.get("search") || "").trim();
    const categoryId = searchParams.get("categoryId");
    const paymentStatus = searchParams.get("paymentStatus");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const filter: Record<string, unknown> = {
      businessId: tenant.businessId,
      isReversed: false,
    };
    if (categoryId) filter.categoryId = categoryId;
    if (
      paymentStatus &&
      EXPENSE_PAYMENT_STATUSES.includes(
        paymentStatus as (typeof EXPENSE_PAYMENT_STATUSES)[number],
      )
    ) {
      filter.paymentStatus = paymentStatus;
    }
    if (from || to) {
      filter.expenseDate = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      };
    }
    if (search) {
      const safe = escapeRegex(search);
      filter.$or = [
        { title: { $regex: safe, $options: "i" } },
        { expenseNumber: { $regex: safe, $options: "i" } },
        { categoryName: { $regex: safe, $options: "i" } },
      ];
    }

    const [total, rows, statsAgg] = await Promise.all([
      Expense.countDocuments(filter),
      Expense.find(filter)
        .sort({ expenseDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Expense.aggregate<{
        totalExpenses: number;
        paidExpenses: number;
        pendingExpenses: number;
        count: number;
      }>([
        {
          $match: {
            businessId: tenant.businessId,
            isReversed: false,
          },
        },
        {
          $group: {
            _id: null,
            totalExpenses: { $sum: "$amount" },
            paidExpenses: { $sum: "$amountPaid" },
            pendingExpenses: { $sum: "$balanceDue" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    return jsonOk({
      data: rows.map((row) => ({
        ...row,
        _id: String(row._id),
        categoryId: String(row.categoryId),
        accountId: row.accountId ? String(row.accountId) : null,
        expenseDate: row.expenseDate.toISOString(),
        paymentDate: row.paymentDate ? row.paymentDate.toISOString() : null,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      stats: {
        totalExpenses: roundMoney(statsAgg[0]?.totalExpenses ?? 0),
        paidExpenses: roundMoney(statsAgg[0]?.paidExpenses ?? 0),
        pendingExpenses: roundMoney(statsAgg[0]?.pendingExpenses ?? 0),
        count: statsAgg[0]?.count ?? 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenant(request);
    const body = createSchema.parse(await request.json());
    const expense = await createExpense({
      scope: scopeFromTenant(tenant),
      data: body,
    });
    return jsonOk(
      {
        data: {
          ...expense.toObject(),
          _id: String(expense._id),
        },
      },
      201,
    );
  } catch (error) {
    return handleApiError(error);
  }
}
