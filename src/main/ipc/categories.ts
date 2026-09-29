import { getDb } from "../db/database";
import { registerIpcHandler } from "./handler";
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  positiveId,
} from "./validation";

interface CategoryRow {
  id: number;
  title: string;
  parent_id: number | null;
  created_at: string;
}

export function registerCategoryHandlers(): void {
  registerIpcHandler("categories:getAll", "void", () => {
    const rows = getDb()
      .prepare(
        `
          SELECT c.*, p.title AS parent_title
          FROM categories c
          LEFT JOIN categories p ON c.parent_id = p.id
          ORDER BY COALESCE(c.parent_id, c.id), c.title
        `,
      )
      .all();
    return { success: true, data: rows };
  });

  registerIpcHandler("categories:create", categoryCreateSchema, (data) => {
    const { lastInsertRowid } = getDb()
      .prepare("INSERT INTO categories (title, parent_id) VALUES (?, ?)")
      .run(data.title, data.parent_id ?? null);
    return { success: true, data: { id: Number(lastInsertRowid) } };
  });

  registerIpcHandler("categories:update", categoryUpdateSchema, (data) => {
    const row = getDb()
      .prepare("SELECT * FROM categories WHERE id = ?")
      .get(data.id) as CategoryRow | undefined;
    if (!row) return { success: false, error: "Category not found" };

    getDb()
      .prepare("UPDATE categories SET title = ?, parent_id = ? WHERE id = ?")
      .run(
        data.title ?? row.title,
        data.parent_id !== undefined ? data.parent_id : row.parent_id,
        data.id,
      );
    return { success: true };
  });

  registerIpcHandler("categories:delete", positiveId, (id) => {
    getDb().prepare("DELETE FROM categories WHERE id = ?").run(id);
    return { success: true };
  });
}
