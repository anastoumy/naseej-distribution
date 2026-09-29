import type Database from "better-sqlite3";

export const LOW_STOCK_THRESHOLD = 5;

export function getStockQty(
  db: Database.Database,
  productId: number,
  flavorId: number | null,
): number {
  const row = db
    .prepare(
      "SELECT quantity FROM inventory WHERE product_id = ? AND flavor_id IS ?",
    )
    .get(productId, flavorId) as { quantity: number } | undefined;
  return row?.quantity ?? 0;
}

export function ensureInventoryRow(
  db: Database.Database,
  productId: number,
  flavorId: number | null,
): void {
  const existing = db
    .prepare(
      "SELECT id FROM inventory WHERE product_id = ? AND flavor_id IS ?",
    )
    .get(productId, flavorId);

  if (!existing) {
    db.prepare(
      "INSERT INTO inventory (product_id, flavor_id, quantity) VALUES (?, ?, 0)",
    ).run(productId, flavorId);
  }
}

export function adjustStock(
  db: Database.Database,
  productId: number,
  flavorId: number | null,
  delta: number,
): number {
  ensureInventoryRow(db, productId, flavorId);
  db.prepare(
    "UPDATE inventory SET quantity = quantity + ? WHERE product_id = ? AND flavor_id IS ?",
  ).run(delta, productId, flavorId);
  return getStockQty(db, productId, flavorId);
}

/** Sum of warehouse stock reserved for open (non-delivered) orders. */
export function getReservedInventory(
  db: Database.Database,
  productId: number,
  flavorId: number | null,
  excludeOrderId?: number,
): number {
  const row = db
    .prepare(
      `
        SELECT COALESCE(SUM(oi.inventory_allocated), 0) AS total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE oi.product_id = ?
          AND oi.flavor_id IS ?
          AND o.fulfillment_status NOT IN ('delivered', 'cancelled')
          AND o.status != 'cancelled'
          AND (? IS NULL OR oi.order_id != ?)
      `,
    )
    .get(productId, flavorId, excludeOrderId ?? null, excludeOrderId ?? null) as {
    total: number;
  };

  return row.total;
}

/** Physical stock minus reservations from other open orders. */
export function getAvailableInventory(
  db: Database.Database,
  productId: number,
  flavorId: number | null,
  excludeOrderId?: number,
): number {
  const physical = getStockQty(db, productId, flavorId);
  const reserved = getReservedInventory(db, productId, flavorId, excludeOrderId);
  return Math.max(0, Number((physical - reserved).toFixed(2)));
}

export function syncInventoryForProduct(
  db: Database.Database,
  productId: number,
  flavorIds: number[],
): void {
  if (flavorIds.length > 0) {
    for (const flavorId of flavorIds) {
      ensureInventoryRow(db, productId, flavorId);
    }
    return;
  }

  ensureInventoryRow(db, productId, null);
}

export function backfillInventoryRows(db: Database.Database): void {
  const products = db
    .prepare("SELECT id FROM products")
    .all() as { id: number }[];

  for (const product of products) {
    const flavorRows = db
      .prepare("SELECT flavor_id FROM product_flavors WHERE product_id = ?")
      .all(product.id) as { flavor_id: number }[];

    syncInventoryForProduct(
      db,
      product.id,
      flavorRows.map((row) => row.flavor_id),
    );
  }
}
