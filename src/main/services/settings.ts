import type Database from "better-sqlite3";

export const SETTING_KEYS = [
  "company_name",
  "company_name_ar",
  "company_phone",
  "company_address",
  "company_email",
  "company_cr",
  "company_po_box",
  "company_vatin",
  "invoice_prefix",
  "currency_symbol",
  "default_tax",
  "invoice_footer",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

export interface AppSettings {
  company_name: string;
  company_name_ar: string;
  company_phone: string;
  company_address: string;
  company_email: string;
  company_cr: string;
  company_po_box: string;
  company_vatin: string;
  invoice_prefix: string;
  currency_symbol: string;
  default_tax: number;
  invoice_footer: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  company_name: "Naseej Distribution",
  company_name_ar: "",
  company_phone: "+968 0000 0000",
  company_address: "Muscat, Oman",
  company_email: "",
  company_cr: "",
  company_po_box: "",
  company_vatin: "",
  invoice_prefix: "",
  currency_symbol: "OMR",
  default_tax: 0.05,
  invoice_footer: "Thank you for your business.",
};

function parseSettingValue(key: SettingKey, value: string): string | number {
  if (key === "default_tax") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : DEFAULT_SETTINGS.default_tax;
  }
  return value;
}

function serializeSettingValue(key: SettingKey, value: string | number): string {
  if (key === "default_tax") {
    return String(Number(value) || 0);
  }
  return String(value);
}

export function getAppSettings(db: Database.Database): AppSettings {
  const rows = db
    .prepare(
      `
        SELECT key, value
        FROM settings
        WHERE key IN (${SETTING_KEYS.map(() => "?").join(", ")})
      `,
    )
    .all(...SETTING_KEYS) as { key: SettingKey; value: string }[];

  const map = Object.fromEntries(rows.map((row) => [row.key, row.value])) as Partial<
    Record<SettingKey, string>
  >;

  return {
    company_name: map.company_name?.trim() || DEFAULT_SETTINGS.company_name,
    company_name_ar:
      map.company_name_ar?.trim() || DEFAULT_SETTINGS.company_name_ar,
    company_phone: map.company_phone?.trim() || DEFAULT_SETTINGS.company_phone,
    company_address: map.company_address?.trim() || DEFAULT_SETTINGS.company_address,
    company_email: map.company_email?.trim() || DEFAULT_SETTINGS.company_email,
    company_cr: map.company_cr?.trim() || DEFAULT_SETTINGS.company_cr,
    company_po_box: map.company_po_box?.trim() || DEFAULT_SETTINGS.company_po_box,
    company_vatin: map.company_vatin?.trim() || DEFAULT_SETTINGS.company_vatin,
    invoice_prefix: map.invoice_prefix?.trim() || DEFAULT_SETTINGS.invoice_prefix,
    currency_symbol:
      map.currency_symbol?.trim() || DEFAULT_SETTINGS.currency_symbol,
    default_tax: parseSettingValue(
      "default_tax",
      map.default_tax ?? String(DEFAULT_SETTINGS.default_tax),
    ) as number,
    invoice_footer: map.invoice_footer?.trim() || DEFAULT_SETTINGS.invoice_footer,
  };
}

export function setAppSettings(
  db: Database.Database,
  settings: Partial<AppSettings>,
): void {
  const upsert = db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  for (const key of SETTING_KEYS) {
    if (settings[key] === undefined) continue;
    upsert.run(key, serializeSettingValue(key, settings[key]!));
  }
}

export function seedDefaultSettings(db: Database.Database): void {
  const existing = db
    .prepare("SELECT COUNT(*) AS count FROM settings")
    .get() as { count: number };

  if (existing.count > 0) return;

  setAppSettings(db, DEFAULT_SETTINGS);
}
