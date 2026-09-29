import { existsSync, writeFileSync } from "fs";
import { getDb } from "../../db/database";
import { getCompanyInfo, getAppSettings } from "./companyInfo";
import {
  buildItemDescription,
  formatDateLabel,
  formatInvoiceNumber,
  formatMoney,
  PdfLayout,
} from "./layout";
import { getInvoicePath } from "./paths";

interface OrderInvoiceData {
  id: number;
  customer_name: string | null;
  customer_phone: string | null;
  status: string;
  payment_type: string;
  total: number;
  amount_paid: number;
  discount_total: number;
  notes: string | null;
  created_at: string;
  invoice_pdf: string | null;
}

interface OrderItemInvoiceData {
  product_title: string | null;
  flavor_name: string | null;
  quantity: number;
  deducted_qty: number;
  unit_price: number;
  tax_amount: number;
}

function loadOrderInvoiceData(orderId: number): {
  order: OrderInvoiceData;
  items: OrderItemInvoiceData[];
} {
  const db = getDb();
  const order = db
    .prepare(
      `
        SELECT o.*, c.name AS customer_name, c.phone AS customer_phone
        FROM orders o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.id = ?
      `,
    )
    .get(orderId) as OrderInvoiceData | undefined;

  if (!order) {
    throw new Error("Order not found");
  }

  const items = db
    .prepare(
      `
        SELECT
          p.title AS product_title,
          f.name AS flavor_name,
          oi.quantity,
          oi.deducted_qty,
          oi.unit_price,
          oi.tax_amount
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        LEFT JOIN flavors f ON oi.flavor_id = f.id
        WHERE oi.order_id = ?
        ORDER BY oi.id
      `,
    )
    .all(orderId) as OrderItemInvoiceData[];

  return { order, items };
}

function lineAmounts(item: OrderItemInvoiceData): {
  effectiveQty: number;
  subtotal: number;
  tax: number;
  totalIncVat: number;
} {
  const effectiveQty = Math.max(0, item.quantity - item.deducted_qty);
  const subtotal = Number((effectiveQty * item.unit_price).toFixed(3));
  const tax =
    item.quantity > 0
      ? Number((item.tax_amount * (effectiveQty / item.quantity)).toFixed(3))
      : 0;

  return {
    effectiveQty,
    subtotal,
    tax,
    totalIncVat: Number((subtotal + tax).toFixed(3)),
  };
}

function drawCompanyHeader(
  layout: PdfLayout,
  company: ReturnType<typeof getCompanyInfo>,
): void {
  if (company.nameAr) {
    layout.drawTitle(company.nameAr);
  }
  layout.drawTitle(company.name);

  const detailRows: string[] = [];
  if (company.cr) detailRows.push(`C.R : ${company.cr}`);
  if (company.poBox) detailRows.push(`P.O. Box : ${company.poBox}`);
  if (company.phone) detailRows.push(`Tel : ${company.phone}`);
  if (company.email) detailRows.push(`Email: ${company.email}`);
  if (company.vatin) detailRows.push(`VATIN ${company.vatin}`);
  if (company.address) detailRows.push(company.address);

  layout.drawCompanyDetails(detailRows);
  layout.drawDivider();
}

async function buildCustomerInvoicePdf(
  order: OrderInvoiceData,
  items: OrderItemInvoiceData[],
): Promise<Uint8Array> {
  const company = getCompanyInfo(getDb());
  const settings = getAppSettings(getDb());
  const layout = await PdfLayout.create();
  const currency = settings.currency_symbol;
  const vatPercent = Math.round(settings.default_tax * 1000) / 10;

  drawCompanyHeader(layout, company);

  layout.drawTitle("TAX INVOICE");
  layout.drawMetaPair(
    `No. ${formatInvoiceNumber(company.invoicePrefix, order.id)}`,
    `Date : ${formatDateLabel(order.created_at)}`,
  );
  layout.drawKeyValue("Customer", order.customer_name ?? "—");
  if (order.customer_phone) {
    layout.drawKeyValue("Phone", order.customer_phone);
  }
  layout.drawDivider();

  const columns = [
    { label: "Qty", width: 42, align: "center" as const },
    { label: "Description", width: 248, align: "left" as const },
    { label: `Unit price (${currency})`, width: 100, align: "right" as const },
    { label: `Total (${currency})`, width: 109, align: "right" as const },
  ];

  layout.drawTableHeader(columns);

  let subtotalExVat = 0;
  let vatTotal = 0;

  items.forEach((item, index) => {
    const amounts = lineAmounts(item);
    subtotalExVat += amounts.subtotal;
    vatTotal += amounts.tax;

    layout.drawTableRow(
      [
        String(amounts.effectiveQty),
        buildItemDescription(item.product_title, item.flavor_name),
        item.unit_price.toFixed(3),
        amounts.subtotal.toFixed(3),
      ],
      columns,
      { alt: index % 2 === 1 },
    );
  });

  subtotalExVat = Number(subtotalExVat.toFixed(3));
  vatTotal = Number(vatTotal.toFixed(3));
  const totalIncVat = Number(order.total.toFixed(3));

  const totals: { label: string; value: string; bold?: boolean }[] = [
    {
      label: "Sub Total",
      value: formatMoney(subtotalExVat, currency),
    },
  ];

  if (order.discount_total > 0) {
    totals.push({
      label: "Discount",
      value: `-${formatMoney(order.discount_total, currency)}`,
    });
  }

  totals.push({
    label: `VAT Amount (${vatPercent}%)`,
    value: formatMoney(vatTotal, currency),
  });
  totals.push({
    label: "Total Amount (Inc. VAT)",
    value: formatMoney(totalIncVat, currency),
    bold: true,
  });

  layout.drawTotals(totals);

  const debt = Math.max(0, Number((order.total - order.amount_paid).toFixed(3)));
  const prepayment = Math.max(
    0,
    Number((order.amount_paid - order.total).toFixed(3)),
  );

  if (order.amount_paid > 0 || debt > 0 || prepayment > 0) {
    layout.drawDivider();
    layout.drawSubtitle("Payment Details");
    if (order.amount_paid > 0) {
      layout.drawKeyValue(
        "Amount Paid",
        formatMoney(order.amount_paid, currency),
      );
    }
    if (debt > 0) {
      layout.drawKeyValue("Added to Debt", formatMoney(debt, currency));
    }
    if (prepayment > 0) {
      layout.drawKeyValue(
        "Credit Applied",
        formatMoney(prepayment, currency),
      );
    }
  }

  if (order.notes) {
    layout.drawDivider();
    layout.drawKeyValue("Notes", order.notes);
  }

  layout.drawSignatureLine();
  if (settings.invoice_footer) {
    layout.drawLine(settings.invoice_footer);
  }

  return layout.save();
}

export async function exportCustomerInvoicePdf(
  orderId: number,
  options?: { regenerate?: boolean },
): Promise<string> {
  const db = getDb();
  const { order } = loadOrderInvoiceData(orderId);
  const targetPath = getInvoicePath("orders", orderId);

  if (
    !options?.regenerate &&
    order.invoice_pdf &&
    existsSync(order.invoice_pdf)
  ) {
    return order.invoice_pdf;
  }

  const { items } = loadOrderInvoiceData(orderId);
  const pdfBytes = await buildCustomerInvoicePdf(order, items);
  writeFileSync(targetPath, pdfBytes);

  db.prepare("UPDATE orders SET invoice_pdf = ? WHERE id = ?").run(
    targetPath,
    orderId,
  );

  return targetPath;
}

export function resolveCustomerInvoicePdfPath(orderId: number): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT invoice_pdf FROM orders WHERE id = ?")
    .get(orderId) as { invoice_pdf: string | null } | undefined;

  if (!row?.invoice_pdf || !existsSync(row.invoice_pdf)) {
    return null;
  }

  return row.invoice_pdf;
}
