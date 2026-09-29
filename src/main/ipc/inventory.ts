import { getDb } from "../db/database";
import { adjustStock, ensureInventoryRow } from "../services/inventory";
import { registerIpcHandler } from "./handler";
import {
  inventoryAdjustSchema,
  inventorySetQtySchema,
  positiveId,
} from "./validation";

export function registerInventoryHandlers(): void {
  registerIpcHandler("inventory:getAll", "void", () => {
    const rows = getDb()
      .prepare(
        `
          SELECT i.*,
                 p.title AS product_title,
                 f.name  AS flavor_name
          FROM inventory i
          JOIN products p ON i.product_id = p.id
          LEFT JOIN flavors f ON i.flavor_id = f.id
          WHERE i.quantity > 0
          ORDER BY p.title, f.name
        `,
      )
      .all();
    return { success: true, data: rows };
  });

  registerIpcHandler("inventory:getByProduct", positiveId, (productId) => {
    const rows = getDb()
      .prepare(
        `
          SELECT i.*, f.name AS flavor_name
          FROM inventory i
          LEFT JOIN flavors f ON i.flavor_id = f.id
          WHERE i.product_id = ?
            AND i.quantity > 0
        `,
      )
      .all(productId);
    return { success: true, data: rows };
  });

  registerIpcHandler("inventory:adjust", inventoryAdjustSchema, (data) => {
    const db = getDb();
    adjustStock(db, data.product_id, data.flavor_id ?? null, data.delta);
    return { success: true };
  });

  registerIpcHandler("inventory:setQty", inventorySetQtySchema, (data) => {
    const db = getDb();
    const flavorId = data.flavor_id ?? null;
    ensureInventoryRow(db, data.product_id, flavorId);
    db.prepare(
      "UPDATE inventory SET quantity = ? WHERE product_id = ? AND flavor_id IS ?",
    ).run(data.qty, data.product_id, flavorId);
    return { success: true };
  });
}
