import type Database from "better-sqlite3";
import { getAppSettings } from "../settings";

export interface CompanyInfo {
  name: string;
  nameAr: string;
  phone: string;
  address: string;
  email: string;
  cr: string;
  poBox: string;
  vatin: string;
  invoicePrefix: string;
}

export function getCompanyInfo(db: Database.Database): CompanyInfo {
  const settings = getAppSettings(db);
  return {
    name: settings.company_name,
    nameAr: settings.company_name_ar,
    phone: settings.company_phone,
    address: settings.company_address,
    email: settings.company_email,
    cr: settings.company_cr,
    poBox: settings.company_po_box,
    vatin: settings.company_vatin,
    invoicePrefix: settings.invoice_prefix,
  };
}

export { getAppSettings };
