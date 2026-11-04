import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { ZodError } from "zod";

export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isValidObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id) && new Types.ObjectId(id).toString() === id;
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(details !== undefined ? { details } : {}),
    },
    { status },
  );
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError("Validation failed", 400, error.flatten());
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    ((error as { name?: string }).name === "InventoryError" ||
      (error as { name?: string }).name === "TenantError" ||
      (error as { name?: string }).name === "BillingError") &&
    "status" in error &&
    "message" in error
  ) {
    return jsonError(
      String((error as { message: string }).message),
      Number((error as { status: number }).status) || 400,
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  ) {
    const keyPattern = (error as { keyPattern?: Record<string, number> })
      .keyPattern;
    const keys = keyPattern ? Object.keys(keyPattern) : [];
    const field =
      keys.find((key) => key !== "businessId" && key !== "storeId") ??
      keys[0] ??
      "field";
    if (field === "idempotencyKey") {
      return jsonError("This request was already processed.", 409);
    }
    const labels: Record<string, string> = {
      sku: "SKU",
      barcode: "Barcode",
      slug: "Slug",
      normalizedName: "Category name",
      name: "Name",
      adjustmentNumber: "Adjustment number",
      purchaseNumber: "Purchase number",
      saleNumber: "Sale number",
      invoiceNumber: "Invoice number",
    };
    return jsonError(
      `${labels[field] ?? field} already exists. Please use a unique value.`,
      409,
    );
  }

  if (error instanceof Error) {
    if (error.message.includes("MONGODB_URI")) {
      return jsonError(
        "Database is not configured. Set MONGODB_URI in .env.local.",
        503,
      );
    }
    console.error("[api]", error.message);
    return jsonError(error.message, 500);
  }

  console.error("[api]", error);
  return jsonError("Internal server error", 500);
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") || 1) || 1);
  const limitRaw = Number(searchParams.get("limit") || 10) || 10;
  const limit = Math.min(100, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
