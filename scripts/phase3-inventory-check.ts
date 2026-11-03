/**
 * Phase 3 inventory and purchase checks against MongoDB Atlas.
 * Run: npx tsx scripts/phase3-inventory-check.ts
 */
import "./load-env";
import mongoose, { Types } from "mongoose";
import { DELETE as deleteHistory } from "@/app/api/inventory/history/route";
import { GET as getAlerts } from "@/app/api/inventory/alerts/route";
import { GET as getHistory } from "@/app/api/inventory/history/route";
import { GET as getInventory } from "@/app/api/inventory/route";
import { POST as postCategory } from "@/app/api/categories/route";
import { GET as getCategories } from "@/app/api/categories/route";
import { GET as getProducts, POST as postProduct } from "@/app/api/products/route";
import { PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { POST as postPurchase } from "@/app/api/purchases/route";
import { PATCH as patchPurchase } from "@/app/api/purchases/[id]/route";
import {
  createStockAdjustment,
  mutateProductStock,
  scopeFromTenant,
  withMongoTransaction,
  computeNextStock,
  InventoryError,
} from "@/lib/inventory-stock";
import {
  cancelPurchase,
  createPurchaseDraft,
  receivePurchase,
} from "@/lib/purchase-service";
import { suggestedReorderQuantity } from "@/lib/reorder";
import { requireTenant } from "@/lib/tenant";
import { Category } from "@/models/Category";
import { InventoryLog } from "@/models/InventoryLog";
import { Product } from "@/models/Product";
import { Purchase } from "@/models/Purchase";
import { StockAdjustment } from "@/models/StockAdjustment";

const failed: string[] = [];

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed.push(name);
    console.error(`FAIL  ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response) {
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { status: response.status, body: body as Record<string, unknown> };
}

async function main() {
  await check("stock math rejects negative results", async () => {
    let threw = false;
    try {
      computeNextStock({
        previousStock: 2,
        quantity: 5,
        movementType: "STOCK_OUT",
      });
    } catch (error) {
      threw = error instanceof InventoryError && error.status === 409;
    }
    assert(threw, "Expected insufficient stock");

    const sale = computeNextStock({
      previousStock: 5,
      quantity: 2,
      movementType: "SALE",
    });
    assert(sale.newStock === 3, "SALE should decrease stock");

    const returned = computeNextStock({
      previousStock: 3,
      quantity: 2,
      movementType: "SALE_RETURN",
    });
    assert(returned.newStock === 5, "SALE_RETURN should increase stock");

    assert(
      suggestedReorderQuantity(3, 5, 2) === 7,
      "Low-stock reorder should be 7",
    );
    assert(
      suggestedReorderQuantity(0, 5, 2) === 10,
      "Out-of-stock reorder should be 10",
    );
  });

  const tenant = await requireTenant();
  const scope = scopeFromTenant(tenant);
  const run = Date.now().toString(36);
  const sku = `P3TEST-${run}`.toUpperCase();
  const createdProductIds: Types.ObjectId[] = [];
  let categoryId = "";

  try {
    await check("phase 2 catalog routes still respond", async () => {
      const products = await readJson(
        await getProducts(new Request("http://local/api/products?limit=1")),
      );
      const categories = await readJson(
        await getCategories(new Request("http://local/api/categories?limit=1")),
      );
      assert(products.status === 200, `Products status ${products.status}`);
      assert(categories.status === 200, `Categories status ${categories.status}`);
    });

    await check("opening stock creates a product and an inventory log", async () => {
      const categoryResponse = await readJson(
        await postCategory(
          new Request("http://local/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `P3 Test ${run}`,
              description: "Phase 3 check",
              image: "",
              parentCategory: null,
              isActive: true,
            }),
          }),
        ),
      );
      assert(categoryResponse.status === 201, JSON.stringify(categoryResponse.body));
      const category = categoryResponse.body.data as { _id: string };
      categoryId = category._id;

      const productResponse = await readJson(
        await postProduct(
          new Request("http://local/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `P3 Rice ${run}`,
              sku,
              barcode: "",
              description: "Phase 3 check",
              category: categoryId,
              subcategory: null,
              purchasePrice: 40,
              sellingPrice: 55,
              currentStock: 10,
              minStockLevel: 4,
              unit: "kg",
              images: [],
              isActive: true,
              businessId: "000000000000000000000099",
            }),
          }),
        ),
      );
      assert(productResponse.status === 201, JSON.stringify(productResponse.body));
      const product = productResponse.body.data as {
        _id: string;
        currentStock: number;
        businessId: string;
      };
      createdProductIds.push(new Types.ObjectId(product._id));
      assert(product.currentStock === 10, "Opening stock should be 10");
      assert(
        String(product.businessId) === String(tenant.businessId),
        "Client businessId must be ignored",
      );

      const log = await InventoryLog.findOne({
        product: product._id,
        movementType: "OPENING_STOCK",
        businessId: tenant.businessId,
      });
      assert(log, "Opening stock log missing");
      assert(log.previousStock === 0 && log.newStock === 10, "Opening log balances");
    });

    const productId = () => String(createdProductIds[0]);

    async function stockOf(id = productId()) {
      const product = await Product.findOne({
        _id: id,
        businessId: tenant.businessId,
      }).lean();
      return product?.currentStock ?? -1;
    }

    async function adjust(
      adjustmentType: "STOCK_IN" | "STOCK_OUT" | "DAMAGED" | "LOST" | "CORRECTION",
      quantity: number,
      id = productId(),
      idempotencyKey?: string,
    ) {
      return createStockAdjustment({
        scope,
        productId: id,
        adjustmentType,
        quantity,
        reason: `Phase 3 ${adjustmentType}`,
        referenceNumber: `REF-${run}`,
        idempotencyKey,
      });
    }

    await check("stock inward increases on-hand stock", async () => {
      await adjust("STOCK_IN", 4);
      assert((await stockOf()) === 14, "Expected stock 14 after inward");
    });

    await check("stock outward decreases on-hand stock", async () => {
      await adjust("STOCK_OUT", 3);
      assert((await stockOf()) === 11, "Expected stock 11 after outward");
    });

    await check("negative stock is rejected", async () => {
      let status = 0;
      try {
        await adjust("STOCK_OUT", 100);
      } catch (error) {
        status = error instanceof InventoryError ? error.status : 0;
      }
      assert(status === 409, "Expected 409 for negative stock");
      assert((await stockOf()) === 11, "Stock must stay unchanged");
    });

    await check("damaged and lost stock decrease inventory", async () => {
      await adjust("DAMAGED", 1);
      await adjust("LOST", 1);
      assert((await stockOf()) === 9, "Expected stock 9 after damage and loss");
      const damaged = await InventoryLog.findOne({
        product: productId(),
        movementType: "DAMAGED",
      });
      const lost = await InventoryLog.findOne({
        product: productId(),
        movementType: "LOST",
      });
      assert(damaged && lost, "Damage and loss logs missing");
    });

    await check("correction sets absolute stock and writes a log", async () => {
      await adjust("CORRECTION", 12);
      assert((await stockOf()) === 12, "Expected corrected stock 12");
    });

    await check("draft purchase does not change stock", async () => {
      const before = await stockOf();
      const draft = await createPurchaseDraft({
        scope,
        data: {
          supplierName: "P3 Wholesale",
          supplierContact: "9876543210",
          supplierInvoiceNumber: `INV-${run}`,
          supplierId: null,
          items: [
            {
              productId: productId(),
              quantity: 2,
              purchasePrice: 100,
              taxRate: 5,
              discount: 10,
            },
          ],
          discount: 0,
          notes: "phase 3",
        },
      });
      assert(draft.status === "DRAFT", "Purchase should stay a draft");
      assert(draft.tax === 9.5, `Expected GST 9.5, got ${draft.tax}`);
      assert(draft.items[0].taxAmount === 9.5, "Line tax amount missing");
      assert(
        draft.items[0].productNameSnapshot.length > 0 &&
          draft.items[0].skuSnapshot === sku,
        "Snapshots missing",
      );
      assert((await stockOf()) === before, "Draft changed stock");
      await Purchase.deleteOne({ _id: draft._id });
    });

    await check("receiving a purchase increases stock once", async () => {
      const before = await stockOf();
      const draft = await createPurchaseDraft({
        scope,
        data: {
          supplierName: "P3 Wholesale",
          supplierContact: "",
          supplierInvoiceNumber: `INV2-${run}`,
          supplierId: null,
          items: [
            {
              productId: productId(),
              quantity: 2,
              purchasePrice: 20,
              taxRate: 0,
              discount: 0,
            },
          ],
          discount: 0,
          notes: "",
        },
      });
      const received = await receivePurchase({
        purchaseId: String(draft._id),
        scope,
      });
      assert(received.status === "RECEIVED", "Status should be RECEIVED");
      assert(received.receivedAt, "receivedAt missing");
      assert((await stockOf()) === before + 2, "Receive should add 2 units");
      const logs = await InventoryLog.find({
        referenceId: draft._id,
        movementType: "PURCHASE_RECEIVE",
      });
      assert(logs.length === 1, "Expected one purchase inventory log");

      let duplicate = 0;
      try {
        await receivePurchase({ purchaseId: String(draft._id), scope });
      } catch (error) {
        duplicate = error instanceof InventoryError ? error.status : 0;
      }
      assert(duplicate === 409, "Duplicate receive should be rejected");
      assert((await stockOf()) === before + 2, "Duplicate receive changed stock");
    });

    await check("cancelled purchases cannot increase stock", async () => {
      const before = await stockOf();
      const draft = await createPurchaseDraft({
        scope,
        data: {
          supplierName: "P3 Wholesale",
          supplierContact: "",
          supplierInvoiceNumber: "",
          supplierId: null,
          items: [
            {
              productId: productId(),
              quantity: 3,
              purchasePrice: 10,
              taxRate: 0,
              discount: 0,
            },
          ],
          discount: 0,
          notes: "",
        },
      });
      const cancelled = await cancelPurchase(String(draft._id), scope);
      assert(cancelled.status === "CANCELLED", "Expected CANCELLED");
      let status = 0;
      try {
        await receivePurchase({ purchaseId: String(draft._id), scope });
      } catch (error) {
        status = error instanceof InventoryError ? error.status : 0;
      }
      assert(status === 409, "Cancelled receive should fail");
      assert((await stockOf()) === before, "Cancelled purchase changed stock");
    });

    await check("received purchases cannot be edited", async () => {
      const received = await Purchase.findOne({
        businessId: tenant.businessId,
        status: "RECEIVED",
        "items.skuSnapshot": sku,
      });
      assert(received, "Received purchase missing");
      const response = await readJson(
        await patchPurchase(
          new Request("http://local/api/purchases/" + String(received._id), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: "changed" }),
          }),
          { params: Promise.resolve({ id: String(received._id) }) },
        ),
      );
      assert(response.status === 409, `Expected 409, got ${response.status}`);
    });

    await check("idempotent adjustment does not apply twice", async () => {
      const before = await stockOf();
      const key = `p3-${run}-idem`;
      await adjust("STOCK_IN", 1, productId(), key);
      const replay = await adjust("STOCK_IN", 1, productId(), key);
      assert(replay.replayed, "Second call should replay");
      assert((await stockOf()) === before + 1, "Idempotent retry changed stock twice");
    });

    await check("concurrent stock outs do not oversell", async () => {
      const response = await readJson(
        await postProduct(
          new Request("http://local/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `P3 Concurrent ${run}`,
              sku: `${sku}-C`,
              barcode: "",
              description: "",
              category: categoryId,
              subcategory: null,
              purchasePrice: 10,
              sellingPrice: 12,
              currentStock: 8,
              minStockLevel: 1,
              unit: "piece",
              images: [],
              isActive: true,
            }),
          }),
        ),
      );
      assert(response.status === 201, JSON.stringify(response.body));
      const id = String((response.body.data as { _id: string })._id);
      createdProductIds.push(new Types.ObjectId(id));

      const results = await Promise.allSettled(
        Array.from({ length: 8 }, () => adjust("STOCK_OUT", 1, id)),
      );
      const successes = results.filter((result) => result.status === "fulfilled");
      assert(successes.length === 8, `Expected 8 successes, got ${successes.length}`);
      assert((await stockOf(id)) === 0, "Concurrent outs should land on 0");

      let blocked = false;
      try {
        await adjust("STOCK_OUT", 1, id);
      } catch (error) {
        blocked = error instanceof InventoryError && error.status === 409;
      }
      assert(blocked, "Further outward stock should be rejected");
      assert((await stockOf(id)) === 0, "Rejected outward changed stock");
    });

    await check("transaction rollback restores stock", async () => {
      const before = await stockOf();
      const logsBefore = await InventoryLog.countDocuments({
        product: productId(),
      });
      let rolled = false;
      try {
        await withMongoTransaction(async (session) => {
          await mutateProductStock({
            scope,
            productId: productId(),
            quantity: 4,
            movementType: "STOCK_IN",
            session,
          });
          throw new InventoryError("force rollback");
        });
      } catch (error) {
        rolled = error instanceof InventoryError && error.message === "force rollback";
      }
      assert(rolled, "Rollback error was not surfaced");
      assert((await stockOf()) === before, "Rolled-back stock did not match");
      const logsAfter = await InventoryLog.countDocuments({
        product: productId(),
      });
      assert(logsAfter === logsBefore, "Rollback left an inventory log");
    });

    await check("tenant queries hide another business", async () => {
      const foreignId = new Types.ObjectId();
      const foreign = await Product.create({
        businessId: foreignId,
        storeId: null,
        name: `Foreign ${run}`,
        sku: `${sku}-FOREIGN`,
        barcode: "",
        description: "",
        category: categoryId,
        subcategory: null,
        purchasePrice: 1,
        sellingPrice: 2,
        currentStock: 99,
        minStockLevel: 1,
        unit: "piece",
        images: [],
        isActive: true,
      });
      createdProductIds.push(foreign._id);
      const list = await readJson(
        await getProducts(
          new Request(`http://local/api/products?search=${encodeURIComponent(sku)}&limit=50`),
        ),
      );
      const rows = list.body.data as Array<{ sku: string }>;
      assert(
        rows.every((row) => row.sku !== `${sku}-FOREIGN`),
        "Foreign product leaked into the catalog",
      );
      const overview = await readJson(
        await getInventory(new Request("http://local/api/inventory")),
      );
      assert(overview.status === 200, "Inventory overview failed");
      const stats = (overview.body.data as { stats: { totalProducts: number } }).stats;
      assert(typeof stats.totalProducts === "number", "Overview stats missing");
    });

    await check("low-stock alerts use the reorder rule", async () => {
      const response = await readJson(
        await postProduct(
          new Request("http://local/api/products", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: `P3 Low ${run}`,
              sku: `${sku}-LOW`,
              barcode: "",
              description: "",
              category: categoryId,
              subcategory: null,
              purchasePrice: 5,
              sellingPrice: 8,
              currentStock: 2,
              minStockLevel: 5,
              unit: "piece",
              images: [],
              isActive: true,
            }),
          }),
        ),
      );
      assert(response.status === 201, JSON.stringify(response.body));
      createdProductIds.push(
        new Types.ObjectId((response.body.data as { _id: string })._id),
      );
      const alerts = await readJson(
        await getAlerts(
          new Request(
            `http://local/api/inventory/alerts?search=${encodeURIComponent(`${sku}-LOW`)}`,
          ),
        ),
      );
      assert(alerts.status === 200, "Alerts request failed");
      const rows = alerts.body.data as Array<{
        sku: string;
        stockStatus: string;
        suggestedReorder: number;
      }>;
      const row = rows.find((item) => item.sku === `${sku}-LOW`);
      assert(row, "Low stock product missing from alerts");
      assert(row.stockStatus === "low_stock", "Expected low_stock");
      assert(row.suggestedReorder === 8, `Expected reorder 8, got ${row.suggestedReorder}`);
    });

    await check("inventory history exports CSV", async () => {
      const response = await getHistory(
        new Request(
          `http://local/api/inventory/history?format=csv&search=${encodeURIComponent(sku)}`,
        ),
      );
      const csv = await response.text();
      assert(response.status === 200, "CSV status was not 200");
      assert(csv.includes("Reference Number"), "CSV header missing");
      assert(csv.includes(sku), "CSV did not include the test SKU");
    });

    await check("inventory logs cannot be changed through the API", async () => {
      const response = await deleteHistory();
      assert(response.status === 405, "Expected 405 for history delete");
      const log = await InventoryLog.findOne({ product: productId() });
      assert(log, "Log missing");
      let blocked = false;
      try {
        await InventoryLog.updateOne({ _id: log._id }, { reason: "tampered" });
      } catch {
        blocked = true;
      }
      assert(blocked, "Inventory log update should be rejected");
    });

    await check("product updates cannot change stock directly", async () => {
      const response = await readJson(
        await patchProduct(
          new Request("http://local/api/products/" + productId(), {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentStock: 0, name: `P3 Rice ${run}` }),
          }),
          { params: Promise.resolve({ id: productId() }) },
        ),
      );
      assert(response.status === 400, `Expected 400, got ${response.status}`);
      assert((await stockOf()) !== 0, "Direct stock edit changed on-hand quantity");
    });

    await check("purchase API creates a draft without stock movement", async () => {
      const before = await stockOf();
      const response = await readJson(
        await postPurchase(
          new Request("http://local/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              supplierName: "API Supplier",
              supplierContact: "9988776655",
              supplierInvoiceNumber: `API-${run}`,
              items: [
                {
                  productId: productId(),
                  quantity: 1,
                  purchasePrice: 15,
                  taxRate: 0,
                  discount: 0,
                },
              ],
              discount: 0,
              notes: "",
            }),
          }),
        ),
      );
      assert(response.status === 201, JSON.stringify(response.body));
      assert((await stockOf()) === before, "API draft changed stock");
    });
  } finally {
    if (createdProductIds.length > 0) {
      await InventoryLog.collection.deleteMany({
        product: { $in: createdProductIds },
      });
      await StockAdjustment.deleteMany({ product: { $in: createdProductIds } });
      await Purchase.deleteMany({
        "items.product": { $in: createdProductIds },
      });
      await Product.deleteMany({ _id: { $in: createdProductIds } });
    }
    if (categoryId) {
      await Category.deleteOne({ _id: categoryId, businessId: tenant.businessId });
    }
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} check(s) failed.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("\nAll Phase 3 checks passed.");
  await mongoose.disconnect();
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => undefined);
  });
