import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initTestDatabase, resetDatabase } from "../src/main/db/database";
import { clearIpcHandlersForTests, invokeIpcHandler } from "../src/main/ipc/handler";
import { registerCustomerHandlers } from "../src/main/ipc/customers";
import { registerSupplierHandlers } from "../src/main/ipc/suppliers";
import { registerProductHandlers } from "../src/main/ipc/products";
import { registerInventoryHandlers } from "../src/main/ipc/inventory";
import { registerOrderHandlers } from "../src/main/ipc/order";
import { registerPurchaseHandlers } from "../src/main/ipc/purchases";
import { registerDebtHandlers } from "../src/main/ipc/debts";

function registerWorkflowHandlers(): void {
  clearIpcHandlersForTests();
  registerCustomerHandlers();
  registerSupplierHandlers();
  registerProductHandlers();
  registerInventoryHandlers();
  registerOrderHandlers();
  registerPurchaseHandlers();
  registerDebtHandlers();
}

describe("business workflow smoke (IPC integration)", () => {
  beforeEach(() => {
    initTestDatabase();
    registerWorkflowHandlers();
  });

  afterEach(() => {
    clearIpcHandlersForTests();
    resetDatabase();
  });

  it("runs product → sale → purchase receive → collect debt", async () => {
    const supplierRes = await invokeIpcHandler<{ id: number }>(
      "suppliers:create",
      { name: "Supplier A" },
    );
    expect(supplierRes.success).toBe(true);

    const customerRes = await invokeIpcHandler<{ id: number }>(
      "customers:create",
      { name: "Customer A" },
    );
    expect(customerRes.success).toBe(true);

    const productRes = await invokeIpcHandler<{ id: number }>(
      "products:create",
      {
        title: "Chips",
        supplier_id: supplierRes.data!.id,
        price: 2,
        wholesale_price: 1.5,
        purchase_price: 1.2,
        taxable: true,
      },
    );
    expect(productRes.success).toBe(true);

    const checkoutRes = await invokeIpcHandler<{
      id: number;
      debt: number;
      total: number;
    }>("orders:checkout", {
      customer_id: customerRes.data!.id,
      amount_paid: 0,
      items: [
        {
          product_id: productRes.data!.id,
          quantity: 4,
          price: 2,
          tax_amount: 0,
        },
      ],
    });
    expect(checkoutRes.success).toBe(true);
    expect(checkoutRes.data!.debt).toBe(8);

    const purchasesListRes = await invokeIpcHandler<Array<{ id: number }>>(
      "purchases:getAll",
    );
    expect(purchasesListRes.success).toBe(true);
    expect(purchasesListRes.data!.length).toBeGreaterThan(0);

    const purchaseId = purchasesListRes.data![0].id;
    const purchaseRes = await invokeIpcHandler<{
      items: Array<{ id: number; quantity: number }>;
    }>("purchases:getById", purchaseId);
    expect(purchaseRes.success).toBe(true);

    const purchaseItemId = purchaseRes.data!.items[0].id;
    const receiveRes = await invokeIpcHandler(
      "purchases:receiveItem",
      [purchaseItemId, purchaseRes.data!.items[0].quantity],
    );
    expect(receiveRes.success).toBe(true);

    const collectRes = await invokeIpcHandler("debtCollections:create", {
      customer_id: customerRes.data!.id,
      amount: 4,
    });
    expect(collectRes.success).toBe(true);

    const customerAfter = await invokeIpcHandler<{ credit: number }>(
      "customers:getById",
      customerRes.data!.id,
    );
    expect(customerAfter.success).toBe(true);
    expect(customerAfter.data!.credit).toBe(4);

    const supplierAfter = await invokeIpcHandler<{ credit: number }>(
      "suppliers:getById",
      supplierRes.data!.id,
    );
    expect(supplierAfter.success).toBe(true);
    expect(supplierAfter.data!.credit).toBeGreaterThan(0);
  });

  it("allows POS checkout without on-hand inventory", async () => {
    const supplierRes = await invokeIpcHandler<{ id: number }>(
      "suppliers:create",
      { name: "Supplier B" },
    );
    const customerRes = await invokeIpcHandler<{ id: number }>(
      "customers:create",
      { name: "Customer B" },
    );
    const productRes = await invokeIpcHandler<{ id: number }>(
      "products:create",
      {
        title: "Juice",
        supplier_id: supplierRes.data!.id,
        price: 3,
        wholesale_price: 2,
        purchase_price: 1.5,
        taxable: true,
      },
    );

    const checkoutRes = await invokeIpcHandler<{ total: number }>(
      "orders:checkout",
      {
        customer_id: customerRes.data!.id,
        amount_paid: 0,
        items: [
          {
            product_id: productRes.data!.id,
            quantity: 2,
            price: 3,
            tax_amount: 0,
          },
        ],
      },
    );

    expect(checkoutRes.success).toBe(true);
    expect(checkoutRes.data!.total).toBe(6);

    const inventoryRes = await invokeIpcHandler<
      Array<{ product_id: number; quantity: number }>
    >("inventory:getAll");
    const row = inventoryRes.data?.find(
      (entry) => entry.product_id === productRes.data!.id,
    );
    expect(row?.quantity ?? 0).toBe(0);
  });

  it("rejects invalid IPC payloads via Zod", async () => {
    const res = await invokeIpcHandler("customers:create", { name: "" });
    expect(res.success).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
