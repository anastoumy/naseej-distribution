import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { app } from "electron";

export type InvoiceKind = "orders" | "purchases";

export function getInvoicesDir(kind: InvoiceKind): string {
  const dir = join(app.getPath("userData"), "invoices", kind);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getInvoicePath(kind: InvoiceKind, id: number): string {
  return join(getInvoicesDir(kind), `${kind.slice(0, -1)}-${id}.pdf`);
}
