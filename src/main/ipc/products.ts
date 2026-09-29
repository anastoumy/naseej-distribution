import { getDb } from "../db/database";
import { saveProductImage, deleteProductImage, ensureImageDir, getImageDataUrl } from "../db/imageHandler";
import { syncInventoryForProduct } from "../services/inventory";
import log from "../logger";
import { registerIpcHandler } from "./handler";
import {
  imagePathSchema,
  positiveId,
  productCreateSchema,
  productUpdateSchema,
} from "./validation";

interface ProductRow {
  id: number;
  title: string;
  category_id: number | null;
  supplier_id: number | null;
  price: number;
  wholesale_price: number;
  purchase_price: number;
  taxable: number;
  image_path: string | null;
  created_at: string;
}

interface ProductFlavorInput {
  flavor_id: number;
  price: number;
  wholesale_price?: number;
  purchase_price?: number;
}

interface ProductPriceDefaults {
  price: number;
  wholesale_price: number;
  purchase_price: number;
}

function mapProductRow<T extends ProductRow>(row: T) {
  return {
    ...row,
    taxable: row.taxable !== 0,
  };
}

function resolveFlavorPrices(
  flavor: ProductFlavorInput,
  defaults: ProductPriceDefaults,
): Required<ProductFlavorInput> {
  return {
    flavor_id: flavor.flavor_id,
    price: flavor.price,
    wholesale_price: flavor.wholesale_price ?? defaults.wholesale_price,
    purchase_price: flavor.purchase_price ?? defaults.purchase_price,
  };
}

function normalizeProductFlavors(
  data: { flavors?: ProductFlavorInput[]; flavor_ids?: number[] },
  defaults: ProductPriceDefaults,
): Required<ProductFlavorInput>[] {
  if (data.flavors && data.flavors.length > 0) {
    return data.flavors.map((flavor) => resolveFlavorPrices(flavor, defaults));
  }

  if (data.flavor_ids && data.flavor_ids.length > 0) {
    return data.flavor_ids.map((flavor_id) => ({
      flavor_id,
      price: defaults.price,
      wholesale_price: defaults.wholesale_price,
      purchase_price: defaults.purchase_price,
    }));
  }

  return [];
}

function insertProductFlavors(
  db: ReturnType<typeof getDb>,
  productId: number,
  productFlavors: Required<ProductFlavorInput>[],
): void {
  if (productFlavors.length === 0) return;

  const insertFlavor = db.prepare(`
    INSERT OR IGNORE INTO product_flavors (
      product_id, flavor_id, price, wholesale_price, purchase_price
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const flavor of productFlavors) {
    insertFlavor.run(
      productId,
      flavor.flavor_id,
      flavor.price,
      flavor.wholesale_price,
      flavor.purchase_price,
    );
  }
}

export function registerProductHandlers(): void {
  registerIpcHandler("products:getAll", "void", () => {
    const db = getDb();
    const rows = db
      .prepare(`
          SELECT p.*,
                 c.title AS category_title,
                 s.name  AS supplier_name,
                 GROUP_CONCAT(f.name || ' (' || printf('%.2f', pf.price) || ')', ', ') AS flavor_names
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN suppliers  s ON p.supplier_id  = s.id
          LEFT JOIN product_flavors pf ON pf.product_id = p.id
          LEFT JOIN flavors f ON pf.flavor_id = f.id
          GROUP BY p.id
          ORDER BY p.title
        `)
      .all() as (ProductRow & {
      category_title?: string | null;
      supplier_name?: string | null;
      flavor_names?: string | null;
    })[];

    const flavorRows = db
      .prepare(`
          SELECT pf.product_id, f.id, f.name, pf.price, pf.wholesale_price, pf.purchase_price
          FROM product_flavors pf
          JOIN flavors f ON pf.flavor_id = f.id
          ORDER BY f.name
        `)
      .all() as {
      product_id: number;
      id: number;
      name: string;
      price: number;
      wholesale_price: number;
      purchase_price: number;
    }[];

    const flavorsByProduct = new Map<
      number,
      { id: number; name: string; price: number; wholesale_price: number; purchase_price: number }[]
    >();
    for (const row of flavorRows) {
      const bucket = flavorsByProduct.get(row.product_id) ?? [];
      bucket.push({
        id: row.id,
        name: row.name,
        price: row.price,
        wholesale_price: row.wholesale_price,
        purchase_price: row.purchase_price,
      });
      flavorsByProduct.set(row.product_id, bucket);
    }

    const data = rows.map((row) => ({
      ...mapProductRow(row),
      flavors: flavorsByProduct.get(row.id) ?? [],
    }));

    return { success: true, data };
  });

  registerIpcHandler("products:getById", positiveId, (id) => {
    const row = getDb()
      .prepare(`
          SELECT p.*,
                 c.title AS category_title,
                 s.name  AS supplier_name
          FROM products p
          LEFT JOIN categories c ON p.category_id = c.id
          LEFT JOIN suppliers  s ON p.supplier_id  = s.id
          WHERE p.id = ?
        `)
      .get(id) as ProductRow | undefined;
    if (!row) return { success: false, error: "Product not found" };

    const flavors = getDb()
      .prepare(`
          SELECT f.id, f.name, pf.price, pf.wholesale_price, pf.purchase_price
          FROM product_flavors pf
          JOIN flavors f ON pf.flavor_id = f.id
          WHERE pf.product_id = ?
          ORDER BY f.name
        `)
      .all(id);

    return { success: true, data: { ...mapProductRow(row), flavors } };
  });

  registerIpcHandler("products:create", productCreateSchema, async (data) => {
    const db = getDb();
    let productId = 0;
    let imagePath: string | null = null;
    const taxable = data.taxable !== false ? 1 : 0;

    db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare(`
              INSERT INTO products (
                title, category_id, supplier_id, price, wholesale_price, purchase_price, taxable
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `)
        .run(
          data.title,
          data.category_id ?? null,
          data.supplier_id ?? null,
          data.price,
          data.wholesale_price,
          data.purchase_price,
          taxable,
        );
      productId = Number(lastInsertRowid);

      const defaults: ProductPriceDefaults = {
        price: data.price,
        wholesale_price: data.wholesale_price,
        purchase_price: data.purchase_price,
      };
      const productFlavors = normalizeProductFlavors(data, defaults);
      insertProductFlavors(db, productId, productFlavors);

      syncInventoryForProduct(
        db,
        productId,
        productFlavors.map((flavor) => flavor.flavor_id),
      );
    })();

    if (data.imageDataUrl) {
      try {
        imagePath = await saveProductImage(data.imageDataUrl, productId);
        db.prepare("UPDATE products SET image_path = ? WHERE id = ?").run(imagePath, productId);
      } catch (err) {
        log.error("Failed to save product image:", err);
      }
    }

    return { success: true, data: { id: productId } };
  });

  registerIpcHandler("products:update", productUpdateSchema, async (data) => {
    const db = getDb();
    const row = db
      .prepare("SELECT * FROM products WHERE id = ?")
      .get(data.id) as ProductRow | undefined;
    if (!row) return { success: false, error: "Product not found" };

    db.transaction(() => {
      const taxable =
        data.taxable !== undefined ? (data.taxable ? 1 : 0) : row.taxable;

      db.prepare(`
            UPDATE products
            SET title = ?, category_id = ?, supplier_id = ?,
                price = ?, wholesale_price = ?, purchase_price = ?, taxable = ?
            WHERE id = ?
          `).run(
        data.title ?? row.title,
        data.category_id !== undefined ? data.category_id : row.category_id,
        data.supplier_id !== undefined ? data.supplier_id : row.supplier_id,
        data.price ?? row.price,
        data.wholesale_price ?? row.wholesale_price,
        data.purchase_price ?? row.purchase_price,
        taxable,
        data.id,
      );

      if (data.flavors !== undefined || data.flavor_ids !== undefined) {
        db.prepare("DELETE FROM product_flavors WHERE product_id = ?").run(data.id);
        const defaults: ProductPriceDefaults = {
          price: data.price ?? row.price,
          wholesale_price: data.wholesale_price ?? row.wholesale_price,
          purchase_price: data.purchase_price ?? row.purchase_price,
        };
        const productFlavors = normalizeProductFlavors(data, defaults);
        insertProductFlavors(db, data.id, productFlavors);
        syncInventoryForProduct(
          db,
          data.id,
          productFlavors.map((flavor) => flavor.flavor_id),
        );
      }
    })();

    if (data.imageDataUrl) {
      try {
        if (row.image_path) {
          await deleteProductImage(row.image_path);
        }
        const newImagePath = await saveProductImage(data.imageDataUrl, data.id);
        db.prepare("UPDATE products SET image_path = ? WHERE id = ?").run(newImagePath, data.id);
      } catch (err) {
        log.error("Failed to update product image:", err);
      }
    }

    return { success: true };
  });

  registerIpcHandler("products:delete", positiveId, async (id) => {
    const db = getDb();
    const row = db
      .prepare("SELECT image_path FROM products WHERE id = ?")
      .get(id) as { image_path: string | null } | undefined;

    if (row?.image_path) {
      await deleteProductImage(row.image_path);
    }

    db.prepare("DELETE FROM products WHERE id = ?").run(id);
    return { success: true };
  });

  registerIpcHandler("products:getImageDataUrl", imagePathSchema, async (imagePath) => {
    if (!imagePath) {
      return { success: true, data: "" };
    }
    const dataUrl = await getImageDataUrl(imagePath);
    return { success: true, data: dataUrl };
  });
}
