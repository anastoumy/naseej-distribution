import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { app } from "electron";

function resolveFontPath(filename: string): string | null {
  const candidates = [
    join(process.resourcesPath, "fonts", filename),
    join(app.getAppPath(), "resources", "fonts", filename),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function loadFontBytes(filename: string): Uint8Array | null {
  const path = resolveFontPath(filename);
  if (!path) return null;
  return readFileSync(path);
}

export function containsArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}
