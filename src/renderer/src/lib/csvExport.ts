function escapeCsvValue(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function downloadCsv(
  filename: string,
  headers: { key: string; label: string }[],
  rows: Record<string, unknown>[],
): void {
  const headerLine = headers.map((h) => escapeCsvValue(h.label)).join(",");
  const dataLines = rows.map((row) =>
    headers.map((h) => escapeCsvValue(row[h.key])).join(","),
  );
  const csv = [headerLine, ...dataLines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
