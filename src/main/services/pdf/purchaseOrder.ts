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

interface PurchaseInvoiceData {
  id: number;
  supplier_name: string | null;
  status: string;
  total: number;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  invoice_pdf: string | null;
}

interface PurchaseItemInvoiceData {
  product_title: string | null;
  flavor_name: string | null;
  quantity: number;
  received_qty: number;
  unit_cost: number;
}

function loadPurchaseInvoiceData(purchaseId: number): {
  purchase: PurchaseInvoiceData;
  items: PurchaseItemInvoiceData[];
} {
  const db = getDb();
  const purchase = db
    .prepare(
      `
        SELECT p.*, s.name AS supplier_name
        FROM purchases p
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE p.id = ?
      `,
    )
    .get(purchaseId) as PurchaseInvoiceData | undefined;

  if (!purchase) {
    throw new Error("Purchase not found");
  }

  const items = db
    .prepare(
      `
        SELECT
          pr.title AS product_title,
          f.name AS flavor_name,
          pi.quantity,
          pi.received_qty,
          pi.unit_cost
        FROM purchase_items pi
        JOIN products pr ON pi.product_id = pr.id
        LEFT JOIN flavors f ON pi.flavor_id = f.id
        WHERE pi.purchase_id = ?
        ORDER BY pi.id
      `,
    )
    .all(purchaseId) as PurchaseItemInvoiceData[];

  return { purchase, items };
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

async function buildPurchaseOrderPdf(
  purchase: PurchaseInvoiceData,
  items: PurchaseItemInvoiceData[],
): Promise<Uint8Array> {
  const company = getCompanyInfo(getDb());
  const settings = getAppSettings(getDb());
  const layout = await PdfLayout.create();
  const currency = settings.currency_symbol;

  drawCompanyHeader(layout, company);

  layout.drawTitle("PURCHASE ORDER");
  layout.drawMetaPair(
    `PO # ${formatInvoiceNumber(company.invoicePrefix, purchase.id)}`,
    `Date : ${formatDateLabel(purchase.created_at)}`,
  );
  layout.drawKeyValue("Supplier", purchase.supplier_name ?? "—");
  if (purchase.submitted_at) {
    layout.drawKeyValue("Submitted", formatDateLabel(purchase.submitted_at));
  }
  if (purchase.notes) {
    layout.drawKeyValue("Notes", purchase.notes);
  }
  layout.drawDivider();

  const columns = [
    { label: "Qty", width: 42, align: "center" as const },
    { label: "Description", width: 198, align: "left" as const },
    { label: "Received", width: 60, align: "center" as const },
    { label: `Unit Cost (${currency})`, width: 95, align: "right" as const },
    { label: `Total (${currency})`, width: 104, align: "right" as const },
  ];

  layout.drawTableHeader(columns);

  items.forEach((item, index) => {
    const lineTotal = Number((item.quantity * item.unit_cost).toFixed(3));
    layout.drawTableRow(
      [
        String(item.quantity),
        buildItemDescription(item.product_title, item.flavor_name),
        String(item.received_qty),
        item.unit_cost.toFixed(3),
        lineTotal.toFixed(3),
      ],
      columns,
      { alt: index % 2 === 1 },
    );
  });

  layout.drawTotals([
    {
      label: "Invoice Total",
      value: formatMoney(purchase.total, currency),
      bold: true,
    },
  ]);

  layout.drawSignatureLine();
  if (settings.invoice_footer) {
    layout.drawLine(settings.invoice_footer);
  }

  return layout.save();
}

export async function exportPurchaseOrderPdf(
  purchaseId: number,
  options?: { regenerate?: boolean },
): Promise<string> {
  const db = getDb();
  const { purchase } = loadPurchaseInvoiceData(purchaseId);
  const targetPath = getInvoicePath("purchases", purchaseId);

  if (
    !options?.regenerate &&
    purchase.invoice_pdf &&
    existsSync(purchase.invoice_pdf)
  ) {
    return purchase.invoice_pdf;
  }

  const { items } = loadPurchaseInvoiceData(purchaseId);
  const pdfBytes = await buildPurchaseOrderPdf(purchase, items);
  writeFileSync(targetPath, pdfBytes);

  db.prepare("UPDATE purchases SET invoice_pdf = ? WHERE id = ?").run(
    targetPath,
    purchaseId,
  );

  return targetPath;
}

export function resolvePurchaseOrderPdfPath(purchaseId: number): string | null {
  const db = getDb();
  const row = db
    .prepare("SELECT invoice_pdf FROM purchases WHERE id = ?")
    .get(purchaseId) as { invoice_pdf: string | null } | undefined;

  if (!row?.invoice_pdf || !existsSync(row.invoice_pdf)) {
    return null;
  }

  return row.invoice_pdf;
}
