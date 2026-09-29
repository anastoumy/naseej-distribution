import { getDb } from "../db/database";
import { registerIpcHandler } from "./handler";
import { reportDateFilterSchema } from "./validation";

export interface DateRangeFilter {
  from?: string | null;
  to?: string | null;
}

interface DashboardSummary {
  today_order_count: number;
  today_order_value: number;
}

interface OrderByCustomerRow {
  id: number;
  customer_id: number;
  customer_name: string;
  status: string;
  payment_type: string;
  total: number;
  amount_paid: number;
  created_at: string;
}

interface OrderBySupplierRow {
  order_id: number;
  supplier_id: number;
  supplier_name: string;
  customer_name: string;
  line_total: number;
  item_count: number;
  created_at: string;
}

interface PurchaseHistoryRow {
  id: number;
  supplier_id: number;
  supplier_name: string;
  status: string;
  total: number;
  submitted_at: string | null;
  created_at: string;
}

interface PaymentHistoryRow {
  id: number;
  payment_type: "customer" | "supplier";
  party_id: number;
  party_name: string;
  amount: number;
  notes: string | null;
  created_at: string;
}

function buildDateClause(
  column: string,
  filter: DateRangeFilter,
): { clause: string; params: string[] } {
  const params: string[] = [];
  const parts: string[] = [];

  if (filter.from) {
    parts.push(`date(${column}) >= date(?)`);
    params.push(filter.from);
  }
  if (filter.to) {
    parts.push(`date(${column}) <= date(?)`);
    params.push(filter.to);
  }

  return {
    clause: parts.length > 0 ? ` AND ${parts.join(" AND ")}` : "",
    params,
  };
}

export function registerReportHandlers(): void {
  registerIpcHandler("reports:getDashboardSummary", "void", () => {
    const today = new Date().toISOString().split("T")[0];
    const row = getDb()
      .prepare(
        `
          SELECT
            COUNT(*) AS order_count,
            COALESCE(SUM(total), 0) AS order_value
          FROM orders
          WHERE status NOT IN ('draft', 'cancelled')
            AND date(created_at) = date(?)
        `,
      )
      .get(today) as { order_count: number; order_value: number };

    const data: DashboardSummary = {
      today_order_count: row.order_count,
      today_order_value: row.order_value,
    };

    return { success: true, data };
  });

  registerIpcHandler(
    "reports:getOrdersByCustomer",
    reportDateFilterSchema,
    (filter) => {
      const { clause, params } = buildDateClause("o.created_at", filter);
      const customerClause =
        filter.customer_id != null ? " AND o.customer_id = ?" : "";
      const customerParams =
        filter.customer_id != null ? [filter.customer_id] : [];

      const rows = getDb()
        .prepare(
          `
            SELECT
              o.id,
              o.customer_id,
              c.name AS customer_name,
              o.status,
              o.payment_type,
              o.total,
              o.amount_paid,
              o.created_at
            FROM orders o
            JOIN customers c ON c.id = o.customer_id
            WHERE o.status NOT IN ('draft', 'cancelled')
            ${clause}
            ${customerClause}
            ORDER BY o.created_at DESC, o.id DESC
          `,
        )
        .all(...params, ...customerParams) as OrderByCustomerRow[];

      return { success: true, data: rows };
    },
  );

  registerIpcHandler(
    "reports:getOrdersBySupplier",
    reportDateFilterSchema,
    (filter) => {
      const { clause, params } = buildDateClause("o.created_at", filter);
      const supplierClause =
        filter.supplier_id != null ? " AND p.supplier_id = ?" : "";
      const supplierParams =
        filter.supplier_id != null ? [filter.supplier_id] : [];

      const rows = getDb()
        .prepare(
          `
            SELECT
              o.id AS order_id,
              p.supplier_id AS supplier_id,
              s.name AS supplier_name,
              c.name AS customer_name,
              SUM(
                MAX(0, oi.quantity - oi.deducted_qty) * oi.unit_price
                + CASE
                    WHEN oi.quantity > 0
                    THEN oi.tax_amount * MAX(0, oi.quantity - oi.deducted_qty) / oi.quantity
                    ELSE 0
                  END
              ) AS line_total,
              COUNT(oi.id) AS item_count,
              o.created_at
            FROM orders o
            JOIN customers c ON c.id = o.customer_id
            JOIN order_items oi ON oi.order_id = o.id
            JOIN products p ON p.id = oi.product_id
            JOIN suppliers s ON s.id = p.supplier_id
            WHERE o.status NOT IN ('draft', 'cancelled')
              AND p.supplier_id IS NOT NULL
            ${clause}
            ${supplierClause}
            GROUP BY o.id, p.supplier_id
            ORDER BY o.created_at DESC, o.id DESC
          `,
        )
        .all(...params, ...supplierParams) as OrderBySupplierRow[];

      return {
        success: true,
        data: rows.map((r) => ({
          ...r,
          line_total: Number(r.line_total.toFixed(2)),
        })),
      };
    },
  );

  registerIpcHandler(
    "reports:getPurchaseHistory",
    reportDateFilterSchema,
    (filter) => {
      const { clause, params } = buildDateClause("p.created_at", filter);
      const supplierClause =
        filter.supplier_id != null ? " AND p.supplier_id = ?" : "";
      const supplierParams =
        filter.supplier_id != null ? [filter.supplier_id] : [];

      const rows = getDb()
        .prepare(
          `
            SELECT
              p.id,
              p.supplier_id,
              s.name AS supplier_name,
              p.status,
              p.total,
              p.submitted_at,
              p.created_at
            FROM purchases p
            JOIN suppliers s ON s.id = p.supplier_id
            WHERE p.status != 'cancelled'
            ${clause}
            ${supplierClause}
            ORDER BY p.created_at DESC, p.id DESC
          `,
        )
        .all(...params, ...supplierParams) as PurchaseHistoryRow[];

      return { success: true, data: rows };
    },
  );

  registerIpcHandler(
    "reports:getPaymentHistory",
    reportDateFilterSchema,
    (filter) => {
      const type = filter.type ?? "all";
      const { clause: customerClause, params: customerParams } =
        buildDateClause("dc.created_at", filter);
      const { clause: supplierClause, params: supplierParams } =
        buildDateClause("dr.created_at", filter);

      const rows: PaymentHistoryRow[] = [];

      if (type === "all" || type === "customer") {
        const collections = getDb()
          .prepare(
            `
              SELECT
                dc.id,
                'customer' AS payment_type,
                dc.customer_id AS party_id,
                c.name AS party_name,
                dc.amount,
                dc.notes,
                dc.created_at
              FROM debt_collections dc
              JOIN customers c ON c.id = dc.customer_id
              WHERE 1=1
              ${customerClause}
              ORDER BY dc.created_at DESC, dc.id DESC
            `,
          )
          .all(...customerParams) as PaymentHistoryRow[];
        rows.push(...collections);
      }

      if (type === "all" || type === "supplier") {
        const repayments = getDb()
          .prepare(
            `
              SELECT
                dr.id,
                'supplier' AS payment_type,
                dr.supplier_id AS party_id,
                s.name AS party_name,
                dr.amount,
                dr.notes,
                dr.created_at
              FROM debt_repayments dr
              JOIN suppliers s ON s.id = dr.supplier_id
              WHERE 1=1
              ${supplierClause}
              ORDER BY dr.created_at DESC, dr.id DESC
            `,
          )
          .all(...supplierParams) as PaymentHistoryRow[];
        rows.push(...repayments);
      }

      rows.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return { success: true, data: rows };
    },
  );
}
