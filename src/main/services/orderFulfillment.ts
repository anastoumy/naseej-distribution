import type Database from "better-sqlite3";
import { applyOrderDeliveryDebt } from "./creditLedger";
import { adjustStock, getStockQty } from "./inventory";
import { SYNCABLE_ORDER_STATUSES, type SyncableOrderStatus } from "./purchaseSync";

/** Mirrors purchase status flow, plus `delivered` when the customer receives the order. */
export const ORDER_FULFILLMENT_STATUSES = [
  "pending",
  "partially_received",
  "received",
  "delivered",
  "cancelled",
] as const;

export type OrderFulfillmentStatus = (typeof ORDER_FULFILLMENT_STATUSES)[number];

interface LinkedPurchase {
  id: number;
  status: string;
}

interface OrderItemForStock {
  product_id: number;
  flavor_id: number | null;
  quantity: number;
  deducted_qty: number;
  inventory_allocated: number;
  product_title?: string | null;
}

function flavorMatchClause(left: string, right: string): string {
  return `(${left} = ${right} OR (${left} IS NULL AND ${right} IS NULL))`;
}

function isSyncableOrderStatus(status: string): status is SyncableOrderStatus {
  return (SYNCABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

function effectiveQty(quantity: number, deductedQty: number): number {
  return Math.max(0, Number((quantity - deductedQty).toFixed(2)));
}

function purchaseQtyNeeded(item: OrderItemForStock): number {
  const needed = effectiveQty(item.quantity, item.deducted_qty);
  return Math.max(0, Number((needed - item.inventory_allocated).toFixed(2)));
}

function loadOrderItemsForStock(
  db: Database.Database,
  orderId: number,
): OrderItemForStock[] {
  return db
    .prepare(
      `
        SELECT
          oi.product_id,
          oi.flavor_id,
          oi.quantity,
          oi.deducted_qty,
          oi.inventory_allocated,
          p.title AS product_title
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
      `,
    )
    .all(orderId) as OrderItemForStock[];
}

export function checkOrderInventoryForDelivery(
  db: Database.Database,
  orderId: number,
): { ok: boolean; error?: string } {
  for (const item of loadOrderItemsForStock(db, orderId)) {
    const qty = effectiveQty(item.quantity, item.deducted_qty);
    if (qty <= 0) {
      continue;
    }

    const stock = getStockQty(db, item.product_id, item.flavor_id);
    if (stock < qty) {
      const label = item.product_title ?? `Product #${item.product_id}`;
      return {
        ok: false,
        error: `Insufficient inventory for ${label}: need ${qty}, have ${stock}`,
      };
    }
  }

  return { ok: true };
}

export function deductOrderInventory(
  db: Database.Database,
  orderId: number,
): void {
  for (const item of loadOrderItemsForStock(db, orderId)) {
    const qty = effectiveQty(item.quantity, item.deducted_qty);
    if (qty > 0) {
      adjustStock(db, item.product_id, item.flavor_id, -qty);
    }
  }

  db.prepare(
    "UPDATE order_items SET inventory_allocated = 0 WHERE order_id = ?",
  ).run(orderId);
}

export function restoreOrderInventory(
  db: Database.Database,
  orderId: number,
): void {
  for (const item of loadOrderItemsForStock(db, orderId)) {
    const qty = effectiveQty(item.quantity, item.deducted_qty);
    if (qty > 0) {
      adjustStock(db, item.product_id, item.flavor_id, qty);
    }
  }
}

function getLinkedPurchases(
  db: Database.Database,
  orderId: number,
): LinkedPurchase[] {
  return db
    .prepare(
      `
        SELECT DISTINCT pu.id, pu.status
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN purchase_items pi ON pi.product_id = oi.product_id
          AND ${flavorMatchClause("pi.flavor_id", "oi.flavor_id")}
        JOIN purchases pu ON pi.purchase_id = pu.id
          AND pu.supplier_id = p.supplier_id
        WHERE oi.order_id = ?
          AND oi.fulfilled_to_purchase = 1
          AND p.supplier_id IS NOT NULL
          AND pu.status != 'cancelled'
          AND (oi.quantity - oi.deducted_qty) > oi.inventory_allocated
      `,
    )
    .all(orderId) as LinkedPurchase[];
}

function isFullyFromInventory(
  db: Database.Database,
  orderId: number,
): boolean {
  const items = db
    .prepare(
      `
        SELECT quantity, deducted_qty, inventory_allocated
        FROM order_items
        WHERE order_id = ?
          AND fulfilled_to_purchase = 1
      `,
    )
    .all(orderId) as Pick<
    OrderItemForStock,
    "quantity" | "deducted_qty" | "inventory_allocated"
  >[];

  if (items.length === 0) {
    return false;
  }

  return items.every(
    (item) => purchaseQtyNeeded(item as OrderItemForStock) === 0,
  );
}

function deriveFulfillmentStatus(
  orderStatus: string,
  currentFulfillmentStatus: OrderFulfillmentStatus,
  purchases: LinkedPurchase[],
  orderId: number,
  db: Database.Database,
): OrderFulfillmentStatus {
  if (orderStatus === "cancelled") {
    return "cancelled";
  }

  if (orderStatus === "draft" || !isSyncableOrderStatus(orderStatus)) {
    return "pending";
  }

  if (currentFulfillmentStatus === "delivered") {
    return "delivered";
  }

  if (isFullyFromInventory(db, orderId)) {
    return "received";
  }

  if (purchases.length === 0) {
    return "pending";
  }

  const allReceived = purchases.every((purchase) => purchase.status === "received");
  const anyReceived = purchases.some(
    (purchase) =>
      purchase.status === "received" || purchase.status === "partially_received",
  );

  if (allReceived) {
    return "received";
  }

  if (anyReceived) {
    return "partially_received";
  }

  return "pending";
}

export function recalculateOrderFulfillmentStatus(
  db: Database.Database,
  orderId: number,
): OrderFulfillmentStatus {
  const order = db
    .prepare("SELECT status, fulfillment_status FROM orders WHERE id = ?")
    .get(orderId) as
    | { status: string; fulfillment_status: OrderFulfillmentStatus }
    | undefined;

  if (!order) {
    return "pending";
  }

  const purchases = getLinkedPurchases(db, orderId);
  const nextStatus = deriveFulfillmentStatus(
    order.status,
    order.fulfillment_status,
    purchases,
    orderId,
    db,
  );

  if (nextStatus !== order.fulfillment_status) {
    db.prepare("UPDATE orders SET fulfillment_status = ? WHERE id = ?").run(
      nextStatus,
      orderId,
    );
  }

  return nextStatus;
}

export function getOrderIdsForPurchase(
  db: Database.Database,
  purchaseId: number,
): number[] {
  const rows = db
    .prepare(
      `
        SELECT DISTINCT oi.order_id AS id
        FROM purchase_items pi
        JOIN purchases pu ON pi.purchase_id = pu.id
        JOIN order_items oi ON oi.product_id = pi.product_id
          AND ${flavorMatchClause("oi.flavor_id", "pi.flavor_id")}
        JOIN products p ON oi.product_id = p.id
          AND p.supplier_id = pu.supplier_id
        JOIN orders o ON oi.order_id = o.id
        WHERE pi.purchase_id = ?
          AND oi.fulfilled_to_purchase = 1
          AND o.status IN ('confirmed', 'partially_paid', 'paid')
      `,
    )
    .all(purchaseId) as { id: number }[];

  return rows.map((row) => row.id);
}

export function recalculateFulfillmentForPurchase(
  db: Database.Database,
  purchaseId: number,
): void {
  for (const orderId of getOrderIdsForPurchase(db, purchaseId)) {
    recalculateOrderFulfillmentStatus(db, orderId);
  }
}

export function markOrderDelivered(
  db: Database.Database,
  orderId: number,
): { success: boolean; error?: string } {
  const order = db
    .prepare(
      `
        SELECT
          customer_id,
          status,
          fulfillment_status,
          total,
          amount_paid,
          credit_applied
        FROM orders
        WHERE id = ?
      `,
    )
    .get(orderId) as
    | {
        customer_id: number;
        status: string;
        fulfillment_status: OrderFulfillmentStatus;
        total: number;
        amount_paid: number | null;
        credit_applied: number | null;
      }
    | undefined;

  if (!order) {
    return { success: false, error: "Order not found" };
  }

  if (order.status === "draft") {
    return { success: false, error: "Draft orders cannot be marked as delivered" };
  }

  if (order.status === "cancelled") {
    return { success: false, error: "Cancelled orders cannot be marked as delivered" };
  }

  if (order.fulfillment_status === "delivered") {
    return { success: false, error: "Order is already delivered to customer" };
  }

  const inventoryCheck = checkOrderInventoryForDelivery(db, orderId);
  if (!inventoryCheck.ok) {
    return { success: false, error: inventoryCheck.error };
  }

  applyOrderDeliveryDebt(db, order);
  deductOrderInventory(db, orderId);
  db.prepare("UPDATE orders SET fulfillment_status = 'delivered' WHERE id = ?").run(
    orderId,
  );

  return { success: true };
}
