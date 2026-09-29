import type Database from "better-sqlite3";
import { getAvailableInventory } from "./inventory";

export const SYNCABLE_ORDER_STATUSES = [
  "confirmed",
  "partially_paid",
  "paid",
] as const;

export type SyncableOrderStatus = (typeof SYNCABLE_ORDER_STATUSES)[number];

export interface SyncResult {
  purchaseIds: number[];
  itemsSynced: number;
}

interface OrderItemForSync {
  id: number;
  product_id: number;
  flavor_id: number | null;
  quantity: number;
  deducted_qty: number;
  inventory_allocated: number;
  supplier_id: number | null;
  unit_cost: number;
}

function isSyncableStatus(status: string): status is SyncableOrderStatus {
  return (SYNCABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

function effectiveQty(quantity: number, deductedQty: number): number {
  return Math.max(0, Number((quantity - deductedQty).toFixed(2)));
}

function purchaseQtyForItem(item: OrderItemForSync): number {
  const needed = effectiveQty(item.quantity, item.deducted_qty);
  return Math.max(0, Number((needed - item.inventory_allocated).toFixed(2)));
}

function flavorMatchClause(alias = ""): string {
  const col = alias ? `${alias}.flavor_id` : "flavor_id";
  return `(${col} = @flavor_id OR (${col} IS NULL AND @flavor_id IS NULL))`;
}

export function recalculatePurchaseTotal(
  db: Database.Database,
  purchaseId: number,
): number {
  const row = db
    .prepare(
      `
        SELECT COALESCE(SUM(quantity * unit_cost), 0) AS total
        FROM purchase_items
        WHERE purchase_id = ?
      `,
    )
    .get(purchaseId) as { total: number };

  const total = Number(row.total.toFixed(2));
  db.prepare("UPDATE purchases SET total = ? WHERE id = ?").run(total, purchaseId);
  return total;
}

function findOpenPurchaseId(
  db: Database.Database,
  supplierId: number,
): number | null {
  const row = db
    .prepare(
      `
        SELECT id
        FROM purchases
        WHERE supplier_id = ?
          AND submitted_at IS NULL
          AND status NOT IN ('cancelled', 'received')
        ORDER BY id DESC
        LIMIT 1
      `,
    )
    .get(supplierId) as { id: number } | undefined;

  return row?.id ?? null;
}

function createOpenPurchase(
  db: Database.Database,
  supplierId: number,
): number {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO purchases (supplier_id, total) VALUES (?, 0)")
    .run(supplierId);

  return Number(lastInsertRowid);
}

function upsertPurchaseLine(
  db: Database.Database,
  purchaseId: number,
  productId: number,
  flavorId: number | null,
  qty: number,
  unitCost: number,
): void {
  const existing = db
    .prepare(
      `
        SELECT id, quantity
        FROM purchase_items
        WHERE purchase_id = @purchase_id
          AND product_id = @product_id
          AND ${flavorMatchClause()}
      `,
    )
    .get({
      purchase_id: purchaseId,
      product_id: productId,
      flavor_id: flavorId,
    }) as { id: number; quantity: number } | undefined;

  if (existing) {
    db.prepare("UPDATE purchase_items SET quantity = quantity + ? WHERE id = ?").run(
      qty,
      existing.id,
    );
    return;
  }

  db.prepare(
    `
      INSERT INTO purchase_items (
        purchase_id, product_id, flavor_id, quantity, unit_cost
      ) VALUES (?, ?, ?, ?, ?)
    `,
  ).run(purchaseId, productId, flavorId, qty, unitCost);
}

function loadUnfulfilledItems(
  db: Database.Database,
  orderId: number,
): OrderItemForSync[] {
  return db
    .prepare(
      `
        SELECT
          oi.id,
          oi.product_id,
          oi.flavor_id,
          oi.quantity,
          oi.deducted_qty,
          oi.inventory_allocated,
          p.supplier_id,
          COALESCE(
            NULLIF(pf.purchase_price, 0),
            p.purchase_price,
            p.wholesale_price
          ) AS unit_cost
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN product_flavors pf
          ON pf.product_id = oi.product_id AND pf.flavor_id = oi.flavor_id
        WHERE oi.order_id = ?
          AND oi.fulfilled_to_purchase = 0
      `,
    )
    .all(orderId) as OrderItemForSync[];
}

/**
 * Syncs unfulfilled order line items into open supplier purchase invoices.
 * Warehouse stock is allocated first; only the remainder is added to purchases.
 * Must be called inside a transaction when combined with order mutations.
 */
export function syncOrderToPurchases(
  db: Database.Database,
  orderId: number,
): SyncResult {
  const order = db
    .prepare("SELECT status FROM orders WHERE id = ?")
    .get(orderId) as { status: string } | undefined;

  if (!order || !isSyncableStatus(order.status)) {
    return { purchaseIds: [], itemsSynced: 0 };
  }

  const items = loadUnfulfilledItems(db, orderId).filter(
    (item) => item.supplier_id != null && effectiveQty(item.quantity, item.deducted_qty) > 0,
  );

  if (items.length === 0) {
    return { purchaseIds: [], itemsSynced: 0 };
  }

  const purchaseIds = new Set<number>();
  let itemsSynced = 0;

  const markFulfilled = db.prepare(
    "UPDATE order_items SET fulfilled_to_purchase = 1, inventory_allocated = ? WHERE id = ?",
  );

  const bySupplier = new Map<number, OrderItemForSync[]>();
  for (const item of items) {
    const supplierId = item.supplier_id as number;
    const bucket = bySupplier.get(supplierId) ?? [];
    bucket.push(item);
    bySupplier.set(supplierId, bucket);
  }

  for (const [supplierId, supplierItems] of bySupplier.entries()) {
    let purchaseId = findOpenPurchaseId(db, supplierId);
    if (purchaseId == null) {
      purchaseId = createOpenPurchase(db, supplierId);
    }

    purchaseIds.add(purchaseId);

    for (const item of supplierItems) {
      const needed = effectiveQty(item.quantity, item.deducted_qty);
      const available = getAvailableInventory(
        db,
        item.product_id,
        item.flavor_id,
        orderId,
      );
      const inventoryAllocated = Math.min(needed, available);
      const purchaseQty = Math.max(
        0,
        Number((needed - inventoryAllocated).toFixed(2)),
      );

      if (purchaseQty > 0) {
        upsertPurchaseLine(
          db,
          purchaseId,
          item.product_id,
          item.flavor_id,
          purchaseQty,
          item.unit_cost,
        );
      }

      markFulfilled.run(inventoryAllocated, item.id);
      itemsSynced += 1;
    }

    recalculatePurchaseTotal(db, purchaseId);
  }

  return {
    purchaseIds: [...purchaseIds],
    itemsSynced,
  };
}

/**
 * Removes previously synced order quantities from purchase invoices.
 * Only the supplier-order portion is reversed; warehouse allocations are cleared
 * without changing physical inventory.
 */
export function reverseOrderFromPurchases(
  db: Database.Database,
  orderId: number,
): SyncResult {
  const items = db
    .prepare(
      `
        SELECT
          oi.id,
          oi.product_id,
          oi.flavor_id,
          oi.quantity,
          oi.deducted_qty,
          oi.inventory_allocated,
          p.supplier_id
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = ?
          AND oi.fulfilled_to_purchase = 1
          AND p.supplier_id IS NOT NULL
      `,
    )
    .all(orderId) as Omit<OrderItemForSync, "unit_cost">[];

  if (items.length === 0) {
    return { purchaseIds: [], itemsSynced: 0 };
  }

  const purchaseIds = new Set<number>();
  let itemsSynced = 0;

  const findPurchaseItem = db.prepare(
    `
      SELECT pi.id, pi.quantity, pi.purchase_id
      FROM purchase_items pi
      JOIN purchases pu ON pi.purchase_id = pu.id
      WHERE pu.supplier_id = @supplier_id
        AND pi.product_id = @product_id
        AND ${flavorMatchClause("pi")}
        AND pu.status != 'cancelled'
      ORDER BY pu.id DESC
      LIMIT 1
    `,
  );

  const decrementQty = db.prepare(
    "UPDATE purchase_items SET quantity = quantity - ? WHERE id = ?",
  );
  const deleteLine = db.prepare("DELETE FROM purchase_items WHERE id = ?");
  const unmarkFulfilled = db.prepare(
    "UPDATE order_items SET fulfilled_to_purchase = 0, inventory_allocated = 0 WHERE id = ?",
  );

  for (const item of items) {
    const purchaseQty = purchaseQtyForItem(item as OrderItemForSync);
    if (purchaseQty <= 0) {
      unmarkFulfilled.run(item.id);
      itemsSynced += 1;
      continue;
    }

    const purchaseItem = findPurchaseItem.get({
      supplier_id: item.supplier_id,
      product_id: item.product_id,
      flavor_id: item.flavor_id,
    }) as { id: number; quantity: number; purchase_id: number } | undefined;

    if (!purchaseItem) {
      unmarkFulfilled.run(item.id);
      continue;
    }

    const nextQty = Number((purchaseItem.quantity - purchaseQty).toFixed(2));
    if (nextQty <= 0) {
      deleteLine.run(purchaseItem.id);
    } else {
      decrementQty.run(purchaseQty, purchaseItem.id);
    }

    purchaseIds.add(purchaseItem.purchase_id);
    unmarkFulfilled.run(item.id);
    itemsSynced += 1;
  }

  for (const purchaseId of purchaseIds) {
    recalculatePurchaseTotal(db, purchaseId);
    cleanupEmptyPurchase(db, purchaseId);
  }

  return {
    purchaseIds: [...purchaseIds],
    itemsSynced,
  };
}

/**
 * Reverses and re-applies purchase sync after order line items change.
 */
export function resyncOrderPurchases(
  db: Database.Database,
  orderId: number,
): SyncResult {
  reverseOrderFromPurchases(db, orderId);
  return syncOrderToPurchases(db, orderId);
}

function cleanupEmptyPurchase(db: Database.Database, purchaseId: number): void {
  const row = db
    .prepare(
      `
        SELECT
          p.status,
          p.submitted_at,
          (SELECT COUNT(*) FROM purchase_items WHERE purchase_id = p.id) AS item_count,
          (SELECT COALESCE(SUM(received_qty), 0) FROM purchase_items WHERE purchase_id = p.id) AS received_total
        FROM purchases p
        WHERE p.id = ?
      `,
    )
    .get(purchaseId) as
    | {
        status: string;
        submitted_at: string | null;
        item_count: number;
        received_total: number;
      }
    | undefined;

  if (!row) return;

  if (
    row.item_count === 0 &&
    row.received_total === 0 &&
    row.status === "pending" &&
    row.submitted_at == null
  ) {
    db.prepare("DELETE FROM purchases WHERE id = ?").run(purchaseId);
  }
}

/**
 * Reconciliation helper: syncs all orders that still have unfulfilled items.
 */
export function reconcileUnfulfilledOrders(db: Database.Database): SyncResult[] {
  const orderIds = db
    .prepare(
      `
        SELECT DISTINCT o.id
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.status IN ('confirmed', 'partially_paid', 'paid')
          AND oi.fulfilled_to_purchase = 0
          AND (oi.quantity - oi.deducted_qty) > 0
          AND p.supplier_id IS NOT NULL
        ORDER BY o.id
      `,
    )
    .all() as { id: number }[];

  const results: SyncResult[] = [];
  for (const { id } of orderIds) {
    results.push(syncOrderToPurchases(db, id));
  }

  return results;
}
