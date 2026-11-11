import {
  handleApiError,
  isValidObjectId,
  jsonError,
  jsonOk,
} from "@/lib/api";
import { scopeFromTenant } from "@/lib/inventory-stock";
import {
  deleteSupplier,
  getSupplierDetailSummary,
  updateSupplier,
} from "@/lib/supplier-service";
import { requireTenant } from "@/lib/tenant";
import { supplierUpdateSchema } from "@/lib/validators/supplier";
import { Purchase } from "@/models/Purchase";
import { Supplier } from "@/models/Supplier";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid supplier ID.", 400);
    }

    const supplier = await Supplier.findOne({
      _id: id,
      businessId: tenant.businessId,
    }).lean();

    if (!supplier) {
      return jsonError("Supplier not found.", 404);
    }

    const summary = await getSupplierDetailSummary({
      supplierId: id,
      businessId: tenant.businessId,
    });

    const recentPurchases = await Purchase.find({
      businessId: tenant.businessId,
      supplier: id,
    })
      .select(
        "purchaseNumber purchaseDate total status paymentStatus amountPaid balanceDue supplierInvoiceNumber receivedAt",
      )
      .sort({ purchaseDate: -1, createdAt: -1 })
      .limit(10)
      .lean();

    return jsonOk({
      data: {
        ...supplier,
        _id: String(supplier._id),
        businessId: String(supplier.businessId),
        storeId: supplier.storeId ? String(supplier.storeId) : null,
        summary,
        recentPurchases: recentPurchases.map((row) => ({
          ...row,
          _id: String(row._id),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid supplier ID.", 400);
    }

    const body = await request.json();
    const parsed = supplierUpdateSchema.parse(body);
    const supplier = await updateSupplier({
      supplierId: id,
      data: parsed,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk({
      data: {
        ...supplier.toObject(),
        _id: String(supplier._id),
        businessId: String(supplier.businessId),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const tenant = await requireTenant(request);
    const { id } = await context.params;

    if (!isValidObjectId(id)) {
      return jsonError("Invalid supplier ID.", 400);
    }

    const result = await deleteSupplier({
      supplierId: id,
      scope: scopeFromTenant(tenant),
    });

    return jsonOk({
      data: result,
      message: "Supplier deleted successfully.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
