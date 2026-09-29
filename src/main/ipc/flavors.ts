import { getDb } from "../db/database";
import { registerIpcHandler } from "./handler";
import {
  flavorCreateSchema,
  flavorUpdateSchema,
  positiveId,
} from "./validation";

interface FlavorRow {
  id: number;
  name: string;
  created_at: string;
}

export function registerFlavorHandlers(): void {
  registerIpcHandler("flavors:getAll", "void", () => {
    const rows = getDb().prepare("SELECT * FROM flavors ORDER BY name").all();
    return { success: true, data: rows };
  });

  registerIpcHandler("flavors:create", flavorCreateSchema, (data) => {
    const { lastInsertRowid } = getDb()
      .prepare("INSERT INTO flavors (name) VALUES (?)")
      .run(data.name);
    return { success: true, data: { id: Number(lastInsertRowid) } };
  });

  registerIpcHandler("flavors:update", flavorUpdateSchema, (data) => {
    const row = getDb()
      .prepare("SELECT * FROM flavors WHERE id = ?")
      .get(data.id) as FlavorRow | undefined;
    if (!row) return { success: false, error: "Flavor not found" };

    getDb().prepare("UPDATE flavors SET name = ? WHERE id = ?").run(data.name, data.id);
    return { success: true };
  });

  registerIpcHandler("flavors:delete", positiveId, (id) => {
    getDb().prepare("DELETE FROM flavors WHERE id = ?").run(id);
    return { success: true };
  });
}
