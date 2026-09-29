import { shell } from "electron";
import { getDb } from "../db/database";
import {
  exportPurchaseOrderPdf,
  printPdfFile,
  resolvePurchaseOrderPdfPath,
} from "../services/pdf";
import { recalculateFulfillmentForPurchase, recalculateOrderFulfillmentStatus } from "../services/orderFulfillment";
import {
  reconcileUnfulfilledOrders,
} from "../services/purchaseSync";
import { adjustStock } from "../services/inventory";
import { registerIpcHandler } from "./handler";
import {
  idNonNegativeQtyTupleSchema,
  positiveId,
  purchaseExportPdfSchema,
  purchaseStatusUpdateTupleSchema,
} from "./validation";

type PurchaseStatus = "pending" | "received" | "partially_received" | "cancelled";

interface PurchaseRow {
  id: number;
  supplier_id: number;
  status: PurchaseStatus;
  total: number;
  invoice_pdf: string | null;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
}

interface PurchaseItemRow {
  id: number;
  purchase_id: number;
  product_id: number;
  product_title?: string | null;
  flavor_id: number | null;
  flavor_name?: string | null;
  quantity: number;
  unit_cost: number;
  received_qty: number;
  created_at: string;
}

function loadPurchaseItems(purchaseId: number) {
  const rows = getDb()
    .prepare(
      `
        SELECT pi.*, p.title AS product_title, f.name AS flavor_name
        FROM purchase_items pi
        JOIN products p ON pi.product_id = p.id
        LEFT JOIN flavors f ON pi.flavor_id = f.id
        WHERE pi.purchase_id = ?
        ORDER BY pi.id
      `,
    )
    .all(purchaseId) as PurchaseItemRow[];

  return rows.map((row) => ({
    ...row,
    remaining_qty: Number((row.quantity - row.received_qty).toFixed(2)),
  }));
}

function recalculatePurchaseStatus(purchaseId: number): PurchaseStatus {
  const db = getDb();
  const items = db
    .prepare(
      "SELECT quantity, received_qty FROM purchase_items WHERE purchase_id = ?",
    )
    .all(purchaseId) as { quantity: number; received_qty: number }[];

  if (items.length === 0) {
    return "pending";
  }

  const allReceived = items.every((item) => item.received_qty >= item.quantity);
  const anyReceived = items.some((item) => item.received_qty > 0);

  if (allReceived) {
    return "received";
  }

  if (anyReceived) {
    return "partially_received";
  }

  return "pending";
}

function getReceivedCreditAmount(purchaseId: number): number {
  const rows = getDb()
    .prepare(
      `
        SELECT received_qty, unit_cost
        FROM purchase_items
        WHERE purchase_id = ?
      `,
    )
    .all(purchaseId) as { received_qty: number; unit_cost: number }[];

  return Number(
    rows.reduce((sum, row) => sum + row.received_qty * row.unit_cost, 0).toFixed(2),
  );
}

function setSupplierCredit(supplierId: number, delta: number): void {
  if (delta === 0) {
    return;
  }

  getDb()
    .prepare("UPDATE suppliers SET credit = credit + ? WHERE id = ?")
    .run(delta, supplierId);
}

export function registerPurchaseHandlers(): void {
  registerIpcHandler("purchases:getAll", "void", () => {
    const rows = getDb()
      .prepare(
        `
            SELECT p.*, s.name AS supplier_name, COUNT(pi.id) AS item_count
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            LEFT JOIN purchase_items pi ON pi.purchase_id = p.id
            GROUP BY p.id
            ORDER BY p.created_at DESC, p.id DESC
          `,
      )
      .all();

    return { success: true, data: rows };
  });

  registerIpcHandler("purchases:getById", positiveId, (id) => {
    const purchase = getDb()
      .prepare(
        `
            SELECT p.*, s.name AS supplier_name
            FROM purchases p
            LEFT JOIN suppliers s ON p.supplier_id = s.id
            WHERE p.id = ?
          `,
      )
      .get(id) as (PurchaseRow & { supplier_name?: string | null }) | undefined;

    if (!purchase) {
      return { success: false, error: "Purchase not found" };
    }

    return { success: true, data: { ...purchase, items: loadPurchaseItems(id) } };
  });

  registerIpcHandler("purchases:generate", "void", () => {
    const db = getDb();
    const results = db.transaction(() => reconcileUnfulfilledOrders(db))();

    const purchaseIds = [
      ...new Set(results.flatMap((result) => result.purchaseIds)),
    ];

    const orderIds = db
      .prepare(
        `
          SELECT DISTINCT oi.order_id AS id
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id
          WHERE oi.fulfilled_to_purchase = 1
            AND o.status IN ('confirmed', 'partially_paid', 'paid')
        `,
      )
      .all() as { id: number }[];

    db.transaction(() => {
      for (const { id } of orderIds) {
        recalculateOrderFulfillmentStatus(db, id);
      }
    })();

    return {
      success: true,
      data: {
        purchase_ids: purchaseIds,
        orders_processed: results.length,
        items_synced: results.reduce((sum, result) => sum + result.itemsSynced, 0),
      },
    };
  });

  registerIpcHandler("purchases:submit", positiveId, (id) => {
    const db = getDb();
    const purchase = db
      .prepare("SELECT * FROM purchases WHERE id = ?")
      .get(id) as PurchaseRow | undefined;

    if (!purchase) {
      return { success: false, error: "Purchase not found" };
    }

    if (purchase.status === "cancelled") {
      return { success: false, error: "Cannot submit a cancelled purchase" };
    }

    if (purchase.submitted_at) {
      return { success: false, error: "Purchase already submitted" };
    }

    const itemCount = db
      .prepare("SELECT COUNT(*) AS count FROM purchase_items WHERE purchase_id = ?")
      .get(id) as { count: number };

    if (itemCount.count === 0) {
      return { success: false, error: "Cannot submit an empty purchase" };
    }

    db.transaction(() => {
      db.prepare(
        "UPDATE purchases SET submitted_at = CURRENT_TIMESTAMP WHERE id = ?",
      ).run(id);
      recalculateFulfillmentForPurchase(db, id);
    })();

    return { success: true };
  });

  registerIpcHandler(
    "purchases:updateStatus",
    purchaseStatusUpdateTupleSchema,
    ([id, status]) => {
      const db = getDb();
      const purchase = db
        .prepare("SELECT * FROM purchases WHERE id = ?")
        .get(id) as PurchaseRow | undefined;

      if (!purchase) {
        return { success: false, error: "Purchase not found" };
      }

      db.transaction(() => {
        if (status === "cancelled" && purchase.status !== "cancelled") {
          setSupplierCredit(purchase.supplier_id, -getReceivedCreditAmount(id));
        }

        db.prepare("UPDATE purchases SET status = ? WHERE id = ?").run(status, id);
        recalculateFulfillmentForPurchase(db, id);
      })();

      return { success: true };
    },
  );

  registerIpcHandler(
    "purchases:receiveItem",
    idNonNegativeQtyTupleSchema,
    ([id, receivedQty]) => {
      if (receivedQty < 0) {
        return { success: false, error: "Received quantity must be greater than or equal to zero" };
      }

      const db = getDb();
      const item = db
        .prepare(
          `
            SELECT pi.*, p.supplier_id
            FROM purchase_items pi
            JOIN purchases p ON pi.purchase_id = p.id
            WHERE pi.id = ?
          `,
        )
        .get(id) as (PurchaseItemRow & { supplier_id: number }) | undefined;

      if (!item) {
        return { success: false, error: "Purchase item not found" };
      }

      if (receivedQty > item.quantity) {
        return { success: false, error: "Received quantity cannot exceed ordered quantity" };
      }

      const previousCredit = getReceivedCreditAmount(item.purchase_id);
      const updatedItemCredit = Number((receivedQty * item.unit_cost).toFixed(2));
      const deltaCredit = Number((updatedItemCredit - item.received_qty * item.unit_cost).toFixed(2));

      const previousReceived = item.received_qty;
      const deltaReceived = receivedQty - previousReceived;

      db.transaction(() => {
        db.prepare("UPDATE purchase_items SET received_qty = ? WHERE id = ?").run(receivedQty, id);
        setSupplierCredit(item.supplier_id, deltaCredit);

        if (deltaReceived !== 0) {
          adjustStock(
            db,
            item.product_id,
            item.flavor_id ?? null,
            deltaReceived,
          );
        }

        const nextStatus = recalculatePurchaseStatus(item.purchase_id);
        db.prepare("UPDATE purchases SET status = ? WHERE id = ?").run(nextStatus, item.purchase_id);

        recalculateFulfillmentForPurchase(db, item.purchase_id);

        void previousCredit;
        void updatedItemCredit;
      })();

      return { success: true };
    },
  );

  registerIpcHandler("purchases:delete", positiveId, (id) => {
    const db = getDb();
    const purchase = db
      .prepare("SELECT status, supplier_id, submitted_at FROM purchases WHERE id = ?")
      .get(id) as Pick<PurchaseRow, "status" | "supplier_id" | "submitted_at"> | undefined;

    if (!purchase) {
      return { success: false, error: "Purchase not found" };
    }

    if (purchase.status !== "pending") {
      return { success: false, error: "Only pending purchases can be deleted" };
    }

    if (purchase.submitted_at) {
      return { success: false, error: "Submitted purchases cannot be deleted" };
    }

    db.prepare("DELETE FROM purchases WHERE id = ?").run(id);
    return { success: true };
  });

  registerIpcHandler(
    "purchases:exportPdf",
    purchaseExportPdfSchema,
    async (args) => {
      const [id, regenerate = false] = args;
      const path = await exportPurchaseOrderPdf(id, { regenerate });
      return { success: true, data: { path } };
    },
  );

  registerIpcHandler("purchases:openPdf", positiveId, async (id) => {
    let path = resolvePurchaseOrderPdfPath(id);
    if (!path) {
      path = await exportPurchaseOrderPdf(id);
    }
    const result = await shell.openPath(path);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true, data: { path } };
  });

  registerIpcHandler("purchases:printPdf", positiveId, async (id) => {
    let path = resolvePurchaseOrderPdfPath(id);
    if (!path) {
      path = await exportPurchaseOrderPdf(id);
    }
    await printPdfFile(path);
    return { success: true, data: { path } };
  });
}
