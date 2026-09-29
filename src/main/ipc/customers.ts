import { getDb } from "../db/database";
import { insertCustomerDebtAdjustment } from "../services/debtAdjustments";
import { registerIpcHandler } from "./handler";
import {
  customerCreateSchema,
  customerUpdateSchema,
  positiveId,
} from "./validation";

interface CustomerRow {
  id: number;
  name: string;
  phone: string | null;
  credit: number;
  created_at: string;
}

export function registerCustomerHandlers(): void {
  registerIpcHandler("customers:getAll", "void", () => {
    const rows = getDb().prepare("SELECT * FROM customers ORDER BY name").all();
    return { success: true, data: rows };
  });

  registerIpcHandler("customers:getById", positiveId, (id) => {
    const row = getDb()
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(id) as CustomerRow | undefined;
    if (!row) return { success: false, error: "Customer not found" };
    return { success: true, data: row };
  });

  registerIpcHandler("customers:create", customerCreateSchema, (data) => {
    const db = getDb();
    const customerId = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare("INSERT INTO customers (name, phone) VALUES (?, ?)")
        .run(data.name, data.phone ?? null);
      const id = Number(lastInsertRowid);

      if (data.opening_balance !== undefined && data.opening_balance !== 0) {
        insertCustomerDebtAdjustment(
          db,
          id,
          data.opening_balance,
          data.opening_balance_notes ?? "Opening balance",
          data.opening_balance_date,
        );
      }

      return id;
    })();

    return { success: true, data: { id: customerId } };
  });

  registerIpcHandler("customers:update", customerUpdateSchema, (data) => {
    const row = getDb()
      .prepare("SELECT * FROM customers WHERE id = ?")
      .get(data.id) as CustomerRow | undefined;
    if (!row) return { success: false, error: "Customer not found" };

    getDb()
      .prepare("UPDATE customers SET name = ?, phone = ? WHERE id = ?")
      .run(
        data.name ?? row.name,
        data.phone !== undefined ? data.phone : row.phone,
        data.id,
      );
    return { success: true };
  });

  registerIpcHandler("customers:delete", positiveId, (id) => {
    getDb().prepare("DELETE FROM customers WHERE id = ?").run(id);
    return { success: true };
  });
}
