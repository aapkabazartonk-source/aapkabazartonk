import { Types } from "mongoose";
import { RECOGNIZED_SALE_STATUS } from "@/lib/analytics/finance";
import { BUSINESS_TIMEZONE } from "@/lib/analytics/time";
import { escapeRegex } from "@/lib/api";
import type { SaleStatus } from "@/lib/constants";
import { CustomerError } from "@/lib/customer-error";
import {
  stateCodeFromGstin,
  stateCodeFromName,
} from "@/lib/india-states";
import type { StockScope } from "@/lib/inventory-stock";
import { roundMoney } from "@/lib/money";
import type {
  CustomerCreateValues,
  CustomerQuickCreateValues,
  CustomerUpdateValues,
} from "@/lib/validators/customer";
import { Customer } from "@/models/Customer";
import { Sale } from "@/models/Sale";
import type { SalePaymentStatus } from "@/lib/constants";

export function normalizePhoneDigits(phone: string) {
  return phone.replace(/\D/g, "");
}

function resolveStateCode(params: {
  state?: string;
  gstin?: string;
  previous?: string;
}) {
  const fromGstin = stateCodeFromGstin(params.gstin ?? "");
  if (fromGstin) return fromGstin;
  const fromState = stateCodeFromName(params.state ?? "");
  if (fromState) return fromState;
  return (params.previous ?? "").trim();
}

function normalizeCustomerFields(
  data: CustomerCreateValues | CustomerUpdateValues | CustomerQuickCreateValues,
) {
  const phone = data.phone?.trim();
  return {
    name: data.name?.trim(),
    phone,
    phoneNormalized: phone ? normalizePhoneDigits(phone) : undefined,
    email: (data.email ?? "").trim().toLowerCase(),
    address: "address" in data ? (data.address ?? "").trim() : undefined,
    city: "city" in data ? (data.city ?? "").trim() : undefined,
    state: "state" in data ? (data.state ?? "").trim() : undefined,
    pincode: "pincode" in data ? (data.pincode ?? "").trim() : undefined,
    gstin:
      "gstin" in data ? (data.gstin ?? "").trim().toUpperCase() : undefined,
    customerType: data.customerType,
  };
}

async function assertPhoneAvailable(params: {
  businessId: Types.ObjectId;
  phoneNormalized: string;
  excludeId?: string;
}) {
  const existing = await Customer.findOne({
    businessId: params.businessId,
    phoneNormalized: params.phoneNormalized,
    isActive: true,
    ...(params.excludeId ? { _id: { $ne: params.excludeId } } : {}),
  })
    .select("_id name phone")
    .lean();

  if (existing) {
    throw new CustomerError(
      `A customer with mobile number ${existing.phone} already exists (${existing.name}). Choose a different number — records are not merged.`,
      409,
      "DUPLICATE_PHONE",
    );
  }
}

function serializeCustomer(row: {
  _id: Types.ObjectId;
  businessId: Types.ObjectId;
  storeId?: Types.ObjectId | null;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  gstin?: string;
  customerType?: string;
  notes?: string;
  totalSpent?: number;
  orderCount?: number;
  isActive?: boolean;
  deletedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    _id: String(row._id),
    businessId: String(row.businessId),
    storeId: row.storeId ? String(row.storeId) : null,
    name: row.name,
    phone: row.phone,
    email: row.email ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
    stateCode: row.stateCode ?? "",
    pincode: row.pincode ?? "",
    gstin: row.gstin ?? "",
    customerType: row.customerType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
    notes: row.notes ?? "",
    totalSpent: row.totalSpent ?? 0,
    orderCount: row.orderCount ?? 0,
    isActive: row.isActive !== false,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createCustomer(params: {
  data: CustomerCreateValues | CustomerQuickCreateValues;
  scope: StockScope;
}) {
  const { data, scope } = params;
  const fields = normalizeCustomerFields(data);
  if (!fields.name || !fields.phone || !fields.phoneNormalized) {
    throw new CustomerError("Customer name and mobile number are required.");
  }

  await assertPhoneAvailable({
    businessId: scope.businessId,
    phoneNormalized: fields.phoneNormalized,
  });

  const state = fields.state ?? "";
  const gstin = fields.gstin ?? "";
  const stateCode = resolveStateCode({ state, gstin });

  try {
    const customer = await Customer.create({
      businessId: scope.businessId,
      storeId: scope.storeId,
      name: fields.name,
      phone: fields.phone,
      phoneNormalized: fields.phoneNormalized,
      email: fields.email,
      address: fields.address ?? "",
      city: fields.city ?? "",
      state,
      stateCode,
      pincode: fields.pincode ?? "",
      gstin,
      customerType: fields.customerType ?? "INDIVIDUAL",
      notes: "",
      totalSpent: 0,
      orderCount: 0,
      isActive: "isActive" in data ? (data.isActive ?? true) : true,
      deletedAt: null,
    });
    return customer;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new CustomerError(
        "A customer with this mobile number already exists for this store. Records are not merged.",
        409,
        "DUPLICATE_PHONE",
      );
    }
    throw error;
  }
}

export async function updateCustomer(params: {
  customerId: string;
  data: CustomerUpdateValues;
  scope: StockScope;
}) {
  const { customerId, data, scope } = params;
  const customer = await Customer.findOne({
    _id: customerId,
    businessId: scope.businessId,
  });

  if (!customer || customer.deletedAt) {
    throw new CustomerError("Customer not found.", 404, "NOT_FOUND");
  }

  const fields = normalizeCustomerFields(data);

  if (fields.phoneNormalized && fields.phoneNormalized !== customer.phoneNormalized) {
    await assertPhoneAvailable({
      businessId: scope.businessId,
      phoneNormalized: fields.phoneNormalized,
      excludeId: customerId,
    });
    customer.phone = fields.phone!;
    customer.phoneNormalized = fields.phoneNormalized;
  } else if (fields.phone !== undefined) {
    customer.phone = fields.phone;
    customer.phoneNormalized = normalizePhoneDigits(fields.phone);
  }

  if (fields.name !== undefined) customer.name = fields.name;
  if (fields.email !== undefined) customer.email = fields.email;
  if (fields.address !== undefined) customer.address = fields.address;
  if (fields.city !== undefined) customer.city = fields.city;
  if (fields.state !== undefined) customer.state = fields.state;
  if (fields.pincode !== undefined) customer.pincode = fields.pincode;
  if (fields.gstin !== undefined) customer.gstin = fields.gstin;
  if (fields.customerType !== undefined) {
    customer.customerType = fields.customerType;
  }
  if (data.isActive !== undefined) {
    customer.isActive = data.isActive;
    if (data.isActive) {
      customer.deletedAt = null;
    }
  }

  customer.stateCode = resolveStateCode({
    state: customer.state,
    gstin: customer.gstin,
    previous: customer.stateCode,
  });

  try {
    await customer.save();
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      throw new CustomerError(
        "A customer with this mobile number already exists for this store. Records are not merged.",
        409,
        "DUPLICATE_PHONE",
      );
    }
    throw error;
  }

  return customer;
}

export async function deleteCustomer(params: {
  customerId: string;
  scope: StockScope;
}) {
  const { customerId, scope } = params;
  const customer = await Customer.findOne({
    _id: customerId,
    businessId: scope.businessId,
  })
    .select("_id name isActive deletedAt")
    .lean();

  if (!customer || customer.deletedAt) {
    throw new CustomerError("Customer not found.", 404, "NOT_FOUND");
  }

  const saleCount = await Sale.countDocuments({
    businessId: scope.businessId,
    customer: customerId,
  });

  if (saleCount > 0) {
    await Customer.updateOne(
      { _id: customerId, businessId: scope.businessId },
      {
        $set: {
          isActive: false,
          deletedAt: new Date(),
        },
      },
    );
    return {
      id: customerId,
      softDeleted: true,
      message:
        "Customer deactivated because linked sales/invoices must be retained.",
    };
  }

  await Customer.deleteOne({
    _id: customerId,
    businessId: scope.businessId,
  });

  return {
    id: customerId,
    softDeleted: false,
    message: "Customer deleted successfully.",
  };
}

export async function getCustomerDashboardStats(businessId: Types.ObjectId) {
  const now = new Date();
  const monthStartParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = monthStartParts.find((part) => part.type === "year")?.value;
  const month = monthStartParts.find((part) => part.type === "month")?.value;
  const monthStart = new Date(`${year}-${month}-01T00:00:00+05:30`);

  const [totalCustomers, newCustomersThisMonth] = await Promise.all([
    Customer.countDocuments({
      businessId,
      isActive: true,
      deletedAt: null,
    }),
    Customer.countDocuments({
      businessId,
      isActive: true,
      deletedAt: null,
      createdAt: { $gte: monthStart },
    }),
  ]);

  return { totalCustomers, newCustomersThisMonth };
}

async function loadPurchaseStatsForCustomers(
  businessId: Types.ObjectId,
  customerIds: Types.ObjectId[],
) {
  if (customerIds.length === 0) {
    return new Map<
      string,
      { totalPurchases: number; totalSpent: number; lastPurchase: Date | null }
    >();
  }

  const rows = await Sale.aggregate<{
    _id: Types.ObjectId;
    totalPurchases: number;
    totalSpent: number;
    lastPurchase: Date;
  }>([
    {
      $match: {
        businessId,
        saleStatus: RECOGNIZED_SALE_STATUS as SaleStatus,
        customer: { $in: customerIds },
      },
    },
    {
      $group: {
        _id: "$customer",
        totalPurchases: { $sum: 1 },
        totalSpent: { $sum: "$grandTotal" },
        lastPurchase: { $max: "$createdAt" },
      },
    },
  ]);

  return new Map(
    rows.map((row) => [
      String(row._id),
      {
        totalPurchases: row.totalPurchases,
        totalSpent: roundMoney(row.totalSpent),
        lastPurchase: row.lastPurchase ?? null,
      },
    ]),
  );
}

export async function listCustomers(params: {
  businessId: Types.ObjectId;
  filter: Record<string, unknown>;
  page: number;
  limit: number;
  skip: number;
  sortField: string;
  order: 1 | -1;
}) {
  const { businessId, filter, page, limit, skip, sortField, order } = params;
  const scoped = { ...filter, businessId };

  const [total, customers, stats] = await Promise.all([
    Customer.countDocuments(scoped),
    Customer.find(scoped)
      .sort({ [sortField]: order })
      .skip(skip)
      .limit(limit)
      .lean(),
    getCustomerDashboardStats(businessId),
  ]);

  const purchaseStats = await loadPurchaseStatsForCustomers(
    businessId,
    customers.map((row) => row._id),
  );

  return {
    data: customers.map((row) => {
      const purchase = purchaseStats.get(String(row._id));
      return {
        ...serializeCustomer(row),
        totalPurchases: purchase?.totalPurchases ?? 0,
        totalAmountSpent: purchase?.totalSpent ?? 0,
        lastPurchaseAt: purchase?.lastPurchase
          ? purchase.lastPurchase.toISOString()
          : null,
      };
    }),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    stats,
  };
}

export async function searchCustomerOptions(params: {
  businessId: Types.ObjectId;
  search?: string;
  limit?: number;
}) {
  const filter: Record<string, unknown> = {
    businessId: params.businessId,
    isActive: true,
    deletedAt: null,
  };
  const search = (params.search ?? "").trim();
  if (search) {
    const safe = escapeRegex(search);
    const digits = normalizePhoneDigits(search);
    filter.$or = [
      { name: { $regex: safe, $options: "i" } },
      { phone: { $regex: safe, $options: "i" } },
      ...(digits
        ? [{ phoneNormalized: { $regex: escapeRegex(digits), $options: "i" } }]
        : []),
      { email: { $regex: safe, $options: "i" } },
    ];
  }

  const customers = await Customer.find(filter)
    .select("name phone email customerType gstin stateCode address city state")
    .sort({ name: 1 })
    .limit(Math.min(50, Math.max(1, params.limit ?? 20)))
    .lean();

  return customers.map((row) => ({
    _id: String(row._id),
    name: row.name,
    phone: row.phone,
    email: row.email ?? "",
    customerType: row.customerType === "BUSINESS" ? "BUSINESS" : "INDIVIDUAL",
    gstin: row.gstin ?? "",
    stateCode: row.stateCode ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    state: row.state ?? "",
  }));
}

export async function getCustomerDetail(params: {
  customerId: string;
  businessId: Types.ObjectId;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const customer = await Customer.findOne({
    _id: params.customerId,
    businessId: params.businessId,
  }).lean();

  if (!customer) {
    throw new CustomerError("Customer not found.", 404, "NOT_FOUND");
  }

  const saleStatus = RECOGNIZED_SALE_STATUS as SaleStatus;
  const saleFilter = {
    businessId: params.businessId,
    customer: customer._id,
    saleStatus,
  };

  type PurchaseRow = {
    _id: Types.ObjectId;
    invoiceNumber: string;
    saleNumber: string;
    createdAt: Date;
    items: unknown[];
    grandTotal: number;
    paymentStatus: SalePaymentStatus;
    saleStatus: SaleStatus;
  };

  const [summaryRows, totalPurchases, purchases] = await Promise.all([
    Sale.aggregate<{
      totalSpent: number;
      lastPurchase: Date | null;
    }>([
      { $match: saleFilter },
      {
        $group: {
          _id: null,
          totalSpent: { $sum: "$grandTotal" },
          lastPurchase: { $max: "$createdAt" },
        },
      },
    ]),
    Sale.countDocuments(saleFilter),
    Sale.find(saleFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "invoiceNumber saleNumber grandTotal paymentStatus saleStatus createdAt items",
      )
      .lean<PurchaseRow[]>(),
  ]);

  const totalSpent = roundMoney(summaryRows[0]?.totalSpent ?? 0);
  const averagePurchaseValue =
    totalPurchases > 0 ? roundMoney(totalSpent / totalPurchases) : 0;

  return {
    ...serializeCustomer(customer),
    stats: {
      totalPurchases,
      totalAmountSpent: totalSpent,
      averagePurchaseValue,
      lastPurchaseAt: summaryRows[0]?.lastPurchase
        ? summaryRows[0].lastPurchase.toISOString()
        : null,
    },
    purchases: {
      data: purchases.map((sale) => ({
        _id: String(sale._id),
        invoiceNumber: sale.invoiceNumber,
        saleNumber: sale.saleNumber,
        date: sale.createdAt.toISOString(),
        itemsCount: Array.isArray(sale.items) ? sale.items.length : 0,
        totalAmount: roundMoney(sale.grandTotal),
        paymentStatus: sale.paymentStatus,
        saleStatus: sale.saleStatus,
      })),
      pagination: {
        page,
        limit,
        total: totalPurchases,
        totalPages: Math.max(1, Math.ceil(totalPurchases / limit)),
      },
    },
  };
}
