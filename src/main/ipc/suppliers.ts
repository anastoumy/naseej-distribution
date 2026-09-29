import { getDb } from "../db/database";
import { insertSupplierDebtAdjustment } from "../services/debtAdjustments";
import { registerIpcHandler } from "./handler";
import {
  positiveId,
  supplierCreateSchema,
  supplierUpdateSchema,
} from "./validation";

interface SupplierRow {
  id: number;
  name: string;
  phone: string | null;
  credit: number;
  created_at: string;
}

export function registerSupplierHandlers(): void {
  registerIpcHandler("suppliers:getAll", "void", () => {
    const rows = getDb().prepare("SELECT * FROM suppliers ORDER BY name").all();
    return { success: true, data: rows };
  });

  registerIpcHandler("suppliers:getById", positiveId, (id) => {
    const row = getDb()
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(id) as SupplierRow | undefined;
    if (!row) return { success: false, error: "Supplier not found" };
    return { success: true, data: row };
  });

  registerIpcHandler("suppliers:create", supplierCreateSchema, (data) => {
    const db = getDb();
    const supplierId = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO suppliers (name, phone) VALUES (?, ?)")
        .run(data.name, data.phone ?? null);
      const id = Number(lastInsertRowid);

      if (data.opening_balance !== undefined && data.opening_balance !== 0) {
        insertSupplierDebtAdjustment(
          db,
          id,
          data.opening_balance,
          data.opening_balance_notes ?? "Opening balance",
          data.opening_balance_date,
        );
      }

      return id;
    })();

    return { success: true, data: { id: supplierId } };
  });

  registerIpcHandler("suppliers:update", supplierUpdateSchema, (data) => {
    const row = getDb()
      .prepare("SELECT * FROM suppliers WHERE id = ?")
      .get(data.id) as SupplierRow | undefined;
    if (!row) return { success: false, error: "Supplier not found" };

    getDb()
      .prepare("UPDATE suppliers SET name = ?, phone = ? WHERE id = ?")
      .run(
        data.name ?? row.name,
        data.phone !== undefined ? data.phone : row.phone,
        data.id,
      );
    return { success: true };
  });

  registerIpcHandler("suppliers:delete", positiveId, (id) => {
    getDb().prepare("DELETE FROM suppliers WHERE id = ?").run(id);
    return { success: true };
  });
}
