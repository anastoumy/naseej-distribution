import { shell } from "electron";
import { getDb } from "../db/database";
import {
  exportCustomerInvoicePdf,
  printPdfFile,
  resolveCustomerInvoicePdfPath,
} from "../services/pdf";
import {
  reverseOrderFromPurchases,
  syncOrderToPurchases,
} from "../services/purchaseSync";
import {
  markOrderDelivered,
  recalculateOrderFulfillmentStatus,
  restoreOrderInventory,
} from "../services/orderFulfillment";
import {
  getOrderCheckoutCreditDelta,
  resolveCheckoutState,
  reverseOrderCreditEffects,
} from "../services/creditLedger";
import { registerIpcHandler } from "./handler";
import {
  idQtyTupleSchema,
  orderAddItemSchema,
  orderCheckoutSchema,
  orderCreateSchema,
  orderExportPdfSchema,
  orderUpdateSchema,
  orderUpdateStatusSchema,
  positiveId,
} from "./validation";

type OrderStatus =
  | "draft"
  | "confirmed"
  | "partially_paid"
  | "paid"
  | "cancelled";
type OrderPaymentType = "cash" | "credit";

interface OrderRow {
  id: number;
  customer_id: number;
  status: OrderStatus;
  payment_type: OrderPaymentType;
  total: number;
  amount_paid: number;
  credit_applied: number;
  discount_total: number;
  fulfillment_status: string;
  invoice_pdf: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number;
  product_title?: string | null;
  flavor_id: number | null;
  flavor_name?: string | null;
  quantity: number;
  unit_price: number;
  tax_amount: number;
  deducted_qty: number;
  created_at: string;
}

function calculateLineTotal(
  row: Pick<
    OrderItemRow,
    "quantity" | "unit_price" | "tax_amount" | "deducted_qty"
  >,
): number {
  const effectiveQty = Math.max(0, row.quantity - row.deducted_qty);
  if (row.quantity <= 0) {
    return 0;
  }

  const taxRatio = effectiveQty / row.quantity;
  return Number(
    (effectiveQty * row.unit_price + row.tax_amount * taxRatio).toFixed(2),
  );
}

function loadOrderItems(orderId: number) {
  const rows = getDb()
    .prepare(
      `
				SELECT oi.*, p.title AS product_title, f.name AS flavor_name
				FROM order_items oi
				JOIN products p ON oi.product_id = p.id
				LEFT JOIN flavors f ON oi.flavor_id = f.id
				WHERE oi.order_id = ?
				ORDER BY oi.id
			`,
    )
    .all(orderId) as OrderItemRow[];

  return rows.map((row) => ({
    ...row,
    effective_qty: Math.max(0, row.quantity - row.deducted_qty),
    line_total: calculateLineTotal(row),
  }));
}

function recalculateOrderTotal(orderId: number): number {
  const db = getDb();
  const items = loadOrderItems(orderId);
  const total = Number(
    items.reduce((sum, item) => sum + (item.line_total ?? 0), 0).toFixed(2),
  );

  db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, orderId);
  return total;
}

export function registerOrderHandlers(): void {
  registerIpcHandler("orders:getAll", "void", () => {
    const rows = getDb()
      .prepare(
        `
						SELECT o.*, c.name AS customer_name, COUNT(oi.id) AS item_count
						FROM orders o
						LEFT JOIN customers c ON o.customer_id = c.id
						LEFT JOIN order_items oi ON oi.order_id = o.id
						GROUP BY o.id
						ORDER BY o.created_at DESC, o.id DESC
					`,
      )
      .all();
    return { success: true, data: rows };
  });

  registerIpcHandler("orders:getById", positiveId, (id) => {
    const order = getDb()
      .prepare(
        `
						SELECT o.*, c.name AS customer_name
						FROM orders o
						LEFT JOIN customers c ON o.customer_id = c.id
						WHERE o.id = ?
					`,
      )
      .get(id) as (OrderRow & { customer_name?: string | null }) | undefined;

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    return { success: true, data: { ...order, items: loadOrderItems(id) } };
  });

  registerIpcHandler("orders:create", orderCreateSchema, (data) => {
    const db = getDb();

    let orderId = 0;

    db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare(
          `
								INSERT INTO orders (customer_id, payment_type, notes, total)
								VALUES (?, ?, ?, ?)
							`,
        )
        .run(
          data.customer_id,
          data.payment_type ?? "cash",
          data.notes ?? null,
          data.total_price ?? 0,
        );

      orderId = Number(lastInsertRowid);

      if (data.items && data.items.length > 0) {
        const insertItem = db.prepare(
          `
								INSERT INTO order_items (
									order_id, product_id, flavor_id, quantity, unit_price, tax_amount, deducted_qty
								) VALUES (?, ?, ?, ?, ?, ?, ?)
							`,
        );

        for (const item of data.items) {
          insertItem.run(
            orderId,
            item.product_id,
            item.flavor_id ?? null,
            item.quantity,
            item.price,
            item.tax_amount ?? 0,
            item.deducted_qty ?? 0,
          );
        }

        recalculateOrderTotal(orderId);
      }
    })();

    return { success: true, data: { id: orderId } };
  });

  registerIpcHandler("orders:checkout", orderCheckoutSchema, (data) => {
    const db = getDb();

    const discountTotal = Math.max(0, Number((data.discount_total ?? 0).toFixed(2)));

    let orderId = 0;
    let checkoutResult: ReturnType<typeof resolveCheckoutState> & {
      total: number;
      amount_paid: number;
    } = {
      status: "paid",
      payment_type: "cash",
      debt: 0,
      prepayment: 0,
      creditUsed: 0,
      creditDelta: 0,
      total: 0,
      amount_paid: 0,
    };

    db.transaction(() => {
      const currentCredit = getCustomerCredit(data.customer_id);

      const { lastInsertRowid } = db
        .prepare(
          `
                INSERT INTO orders (customer_id, payment_type, notes, total, amount_paid, discount_total)
                VALUES (?, 'cash', ?, ?, ?, ?)
              `,
        )
        .run(
          data.customer_id,
          data.notes ?? null,
          data.total_price ?? 0,
          data.amount_paid,
          discountTotal,
        );

      orderId = Number(lastInsertRowid);

      const insertItem = db.prepare(
        `
              INSERT INTO order_items (
                order_id, product_id, flavor_id, quantity, unit_price, tax_amount, deducted_qty
              ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `,
      );

      for (const item of data.items) {
        insertItem.run(
          orderId,
          item.product_id,
          item.flavor_id ?? null,
          item.quantity,
          item.price,
          item.tax_amount ?? 0,
          item.deducted_qty ?? 0,
        );
      }

      const lineTotal = recalculateOrderTotal(orderId);
      const total = Math.max(0, Number((lineTotal - discountTotal).toFixed(2)));
      db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, orderId);

      const state = resolveCheckoutState(currentCredit, total, data.amount_paid);
      checkoutResult = {
        ...state,
        total,
        amount_paid: data.amount_paid,
      };

      db.prepare(
        `
              UPDATE orders
              SET status = ?, payment_type = ?, amount_paid = ?, credit_applied = ?
              WHERE id = ?
            `,
      ).run(
        state.status,
        state.payment_type,
        data.amount_paid,
        state.creditUsed,
        orderId,
      );

      const checkoutCreditDelta = getOrderCheckoutCreditDelta({
        total,
        amount_paid: data.amount_paid,
        credit_applied: state.creditUsed,
      });
      if (checkoutCreditDelta !== 0) {
        db.prepare("UPDATE customers SET credit = credit + ? WHERE id = ?").run(
          checkoutCreditDelta,
          data.customer_id,
        );
      }

      syncOrderToPurchases(db, orderId);
      recalculateOrderFulfillmentStatus(db, orderId);
    })();

    return {
      success: true,
      data: {
        id: orderId,
        status: checkoutResult.status,
        debt: checkoutResult.debt,
        prepayment: checkoutResult.prepayment,
        creditUsed: checkoutResult.creditUsed,
        amount_paid: checkoutResult.amount_paid,
        total: checkoutResult.total,
      },
    };
  });

  registerIpcHandler("orders:update", orderUpdateSchema, (data) => {
    const db = getDb();
    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(data.id) as OrderRow | undefined;

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    db.transaction(() => {
      db.prepare(
        `
							UPDATE orders
							SET customer_id = ?, payment_type = ?, notes = ?, total = ?
							WHERE id = ?
						`,
      ).run(
        data.customer_id ?? order.customer_id,
        data.payment_type ?? order.payment_type,
        data.notes !== undefined ? data.notes : order.notes,
        data.total_price ?? order.total,
        data.id,
      );

      if (data.items !== undefined) {
        const shouldResyncPurchases =
          ["confirmed", "partially_paid", "paid"].includes(order.status) &&
          order.fulfillment_status !== "delivered";

        if (shouldResyncPurchases) {
          reverseOrderFromPurchases(db, data.id);
        }

        db.prepare("DELETE FROM order_items WHERE order_id = ?").run(
          data.id,
        );

        if (data.items.length > 0) {
          const insertItem = db.prepare(
            `
									INSERT INTO order_items (
										order_id, product_id, flavor_id, quantity, unit_price, tax_amount, deducted_qty
									) VALUES (?, ?, ?, ?, ?, ?, ?)
								`,
          );

          for (const item of data.items) {
            insertItem.run(
              data.id,
              item.product_id,
              item.flavor_id ?? null,
              item.quantity,
              item.price,
              item.tax_amount ?? 0,
              item.deducted_qty ?? 0,
            );
          }
        }

        recalculateOrderTotal(data.id);

        if (shouldResyncPurchases) {
          syncOrderToPurchases(db, data.id);
          recalculateOrderFulfillmentStatus(db, data.id);
        }
      }
    })();

    return { success: true };
  });

  registerIpcHandler("orders:updateStatus", orderUpdateStatusSchema, (data) => {
    const db = getDb();
    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(data.id) as OrderRow | undefined;

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const itemCount = db
      .prepare(
        "SELECT COUNT(*) AS count FROM order_items WHERE order_id = ?",
      )
      .get(data.id) as { count: number };

    if (data.status === "confirmed" && itemCount.count === 0) {
      return { success: false, error: "Order must have at least one item" };
    }

    db.transaction(() => {
      if (
        data.status === "cancelled" &&
        ["confirmed", "partially_paid", "paid"].includes(order.status)
      ) {
        if (order.fulfillment_status === "delivered") {
          restoreOrderInventory(db, data.id);
        }
        reverseOrderCreditEffects(db, order, order.fulfillment_status);
        reverseOrderFromPurchases(db, data.id);
      }

      const fulfillmentStatus =
        data.status === "cancelled" ? "cancelled" : order.fulfillment_status;

      db.prepare("UPDATE orders SET status = ?, fulfillment_status = ? WHERE id = ?").run(
        data.status,
        fulfillmentStatus,
        data.id,
      );

      if (
        data.status !== "cancelled" &&
        data.status !== "draft" &&
        ["confirmed", "partially_paid", "paid"].includes(data.status)
      ) {
        syncOrderToPurchases(db, data.id);
        recalculateOrderFulfillmentStatus(db, data.id);
      }
    })();

    return { success: true };
  });

  registerIpcHandler("orders:addItem", orderAddItemSchema, (data) => {
    if (data.price < 0) {
      return {
        success: false,
        error: "Price must be greater than or equal to zero",
      };
    }

    const db = getDb();
    const order = db
      .prepare("SELECT * FROM orders WHERE id = ?")
      .get(data.order_id) as OrderRow | undefined;

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    const { lastInsertRowid } = db
      .prepare(
        `
							INSERT INTO order_items (
								order_id, product_id, flavor_id, quantity, unit_price, tax_amount, deducted_qty
							) VALUES (?, ?, ?, ?, ?, ?, ?)
						`,
      )
      .run(
        data.order_id,
        data.product_id,
        data.flavor_id ?? null,
        data.quantity,
        data.price,
        data.tax_amount ?? 0,
        data.deducted_qty ?? 0,
      );

    recalculateOrderTotal(data.order_id);

    return { success: true, data: { id: Number(lastInsertRowid) } };
  });

  registerIpcHandler("orders:deductItem", idQtyTupleSchema, ([id, qty]) => {
    const db = getDb();
    const item = db
      .prepare("SELECT * FROM order_items WHERE id = ?")
      .get(id) as OrderItemRow | undefined;

    if (!item) {
      return { success: false, error: "Order item not found" };
    }

    if (item.deducted_qty + qty > item.quantity) {
      return {
        success: false,
        error: "Deducted quantity cannot exceed ordered quantity",
      };
    }

    db.prepare(
      "UPDATE order_items SET deducted_qty = deducted_qty + ? WHERE id = ?",
    ).run(qty, id);
    recalculateOrderTotal(item.order_id);

    return { success: true };
  });

  registerIpcHandler("orders:delete", positiveId, (id) => {
    const db = getDb();
    const order = db
      .prepare("SELECT status FROM orders WHERE id = ?")
      .get(id) as { status: OrderStatus } | undefined;

    if (!order) {
      return { success: false, error: "Order not found" };
    }

    if (order.status !== "draft") {
      return { success: false, error: "Only draft orders can be deleted" };
    }

    db.prepare("DELETE FROM orders WHERE id = ?").run(id);
    return { success: true };
  });

  registerIpcHandler(
    "orders:exportPdf",
    orderExportPdfSchema,
    async (args) => {
      const [id, regenerate = false] = args;
      const path = await exportCustomerInvoicePdf(id, { regenerate });
      return { success: true, data: { path } };
    },
  );

  registerIpcHandler("orders:openPdf", positiveId, async (id) => {
    let path = resolveCustomerInvoicePdfPath(id);
    if (!path) {
      path = await exportCustomerInvoicePdf(id);
    }
    const result = await shell.openPath(path);
    if (result) {
      return { success: false, error: result };
    }
    return { success: true, data: { path } };
  });

  registerIpcHandler("orders:printPdf", positiveId, async (id) => {
    let path = resolveCustomerInvoicePdfPath(id);
    if (!path) {
      path = await exportCustomerInvoicePdf(id);
    }
    await printPdfFile(path);
    return { success: true, data: { path } };
  });

  registerIpcHandler("orders:markDelivered", positiveId, (id) => {
    const db = getDb();
    return db.transaction(() => markOrderDelivered(db, id))();
  });
}

function getCustomerCredit(customerId: number): number {
  const row = getDb()
    .prepare("SELECT credit FROM customers WHERE id = ?")
    .get(customerId) as { credit: number } | undefined;
  return row?.credit ?? 0;
}
