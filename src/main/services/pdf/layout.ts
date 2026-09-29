import fontkit from "@pdf-lib/fontkit";
import {
  PDFDocument,
  PDFFont,
  PDFPage,
  RGB,
  StandardFonts,
  rgb,
} from "pdf-lib";
import { containsArabic, loadFontBytes } from "./fonts";

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  text: rgb(0.12, 0.12, 0.12),
  muted: rgb(0.4, 0.4, 0.4),
  border: rgb(0.82, 0.82, 0.82),
  headerBg: rgb(0.95, 0.95, 0.95),
  rowAlt: rgb(0.98, 0.98, 0.98),
};

export interface TableColumn {
  label: string;
  width: number;
  align?: "left" | "right" | "center";
}

export class PdfLayout {
  private doc: PDFDocument;
  private page: PDFPage;
  private y: number;
  readonly latinRegular: PDFFont;
  readonly latinBold: PDFFont;
  readonly arabicRegular: PDFFont | null;
  readonly arabicBold: PDFFont | null;

  private constructor(
    doc: PDFDocument,
    page: PDFPage,
    latinRegular: PDFFont,
    latinBold: PDFFont,
    arabicRegular: PDFFont | null,
    arabicBold: PDFFont | null,
  ) {
    this.doc = doc;
    this.page = page;
    this.latinRegular = latinRegular;
    this.latinBold = latinBold;
    this.arabicRegular = arabicRegular;
    this.arabicBold = arabicBold;
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create(): Promise<PdfLayout> {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    const latinRegular = await doc.embedFont(StandardFonts.Helvetica);
    const latinBold = await doc.embedFont(StandardFonts.HelveticaBold);

    const arabicRegularBytes = loadFontBytes("NotoSansArabic-Regular.ttf");
    const arabicBoldBytes = loadFontBytes("NotoSansArabic-Bold.ttf");

    const arabicRegular = arabicRegularBytes
      ? await doc.embedFont(arabicRegularBytes)
      : null;
    const arabicBold = arabicBoldBytes
      ? await doc.embedFont(arabicBoldBytes)
      : null;

    return new PdfLayout(
      doc,
      page,
      latinRegular,
      latinBold,
      arabicRegular,
      arabicBold,
    );
  }

  get contentWidth(): number {
    return CONTENT_WIDTH;
  }

  private fontFor(text: string, bold = false): PDFFont {
    if (containsArabic(text)) {
      const arabic = bold ? this.arabicBold : this.arabicRegular;
      if (arabic) return arabic;
    }
    return bold ? this.latinBold : this.latinRegular;
  }

  private lineHeight(fontSize: number): number {
    return Math.ceil(fontSize * 1.45);
  }

  private ensureSpace(height: number): void {
    if (this.y - height >= MARGIN) return;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN;
  }

  private textWidth(text: string, fontSize: number, bold = false): number {
    return this.fontFor(text, bold).widthOfTextAtSize(text, fontSize);
  }

  private wrapText(
    text: string,
    maxWidth: number,
    fontSize: number,
    bold = false,
  ): string[] {
    const normalized = text.replace(/\s+/g, " ").trim();
    if (!normalized) return ["—"];

    const words = normalized.split(" ");
    const lines: string[] = [];
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (this.textWidth(candidate, fontSize, bold) <= maxWidth) {
        current = candidate;
        continue;
      }

      if (current) lines.push(current);

      if (this.textWidth(word, fontSize, bold) <= maxWidth) {
        current = word;
        continue;
      }

      let chunk = "";
      for (const char of word) {
        const next = `${chunk}${char}`;
        if (this.textWidth(next, fontSize, bold) <= maxWidth) {
          chunk = next;
        } else {
          if (chunk) lines.push(chunk);
          chunk = char;
        }
      }
      current = chunk;
    }

    if (current) lines.push(current);
    return lines.length > 0 ? lines : ["—"];
  }

  private drawTextAt(
    text: string,
    x: number,
    y: number,
    fontSize: number,
    options?: { bold?: boolean; color?: RGB; maxWidth?: number; align?: "left" | "right" | "center" },
  ): void {
    const font = this.fontFor(text, options?.bold);
    const color = options?.color ?? COLORS.text;
    let drawX = x;

    if (options?.maxWidth && options.align && options.align !== "left") {
      const width = font.widthOfTextAtSize(text, fontSize);
      if (options.align === "right") {
        drawX = x + options.maxWidth - width;
      } else {
        drawX = x + (options.maxWidth - width) / 2;
      }
    }

    this.page.drawText(text, { x: drawX, y, size: fontSize, font, color });
  }

  drawSpacer(height = 8): void {
    this.ensureSpace(height);
    this.y -= height;
  }

  drawTitle(text: string): void {
    const fontSize = 17;
    const height = this.lineHeight(fontSize) + 4;
    this.ensureSpace(height);
    this.drawTextAt(text, MARGIN, this.y, fontSize, { bold: true });
    this.y -= height;
  }

  drawSubtitle(text: string): void {
    const fontSize = 10;
    const height = this.lineHeight(fontSize);
    this.ensureSpace(height);
    this.drawTextAt(text, MARGIN, this.y, fontSize, { color: COLORS.muted });
    this.y -= height;
  }

  drawLine(text: string, bold = false): void {
    const fontSize = 10;
    const lines = this.wrapText(text, CONTENT_WIDTH, fontSize, bold);
    const rowHeight = this.lineHeight(fontSize);

    for (const line of lines) {
      this.ensureSpace(rowHeight);
      this.drawTextAt(line, MARGIN, this.y, fontSize, { bold });
      this.y -= rowHeight;
    }
  }

  drawKeyValue(label: string, value: string): void {
    const fontSize = 10;
    const labelWidth = 120;
    const valueWidth = CONTENT_WIDTH - labelWidth - 8;
    const valueLines = this.wrapText(value, valueWidth, fontSize);
    const rowHeight = this.lineHeight(fontSize);
    const blockHeight = rowHeight * Math.max(1, valueLines.length);

    this.ensureSpace(blockHeight);
    this.drawTextAt(label, MARGIN, this.y, fontSize, { color: COLORS.muted });

    valueLines.forEach((line, index) => {
      const lineY = this.y - index * rowHeight;
      this.drawTextAt(line, MARGIN + labelWidth, lineY, fontSize);
    });

    this.y -= blockHeight;
  }

  drawMetaPair(left: string, right: string): void {
    const fontSize = 10;
    const rowHeight = this.lineHeight(fontSize);
    this.ensureSpace(rowHeight);

    this.drawTextAt(left, MARGIN, this.y, fontSize);
    this.drawTextAt(right, MARGIN, this.y, fontSize, {
      maxWidth: CONTENT_WIDTH,
      align: "right",
    });
    this.y -= rowHeight;
  }

  drawCompanyDetails(rows: string[]): void {
    const fontSize = 9;
    const rowHeight = this.lineHeight(fontSize);

    for (const row of rows) {
      if (!row.trim()) continue;
      this.ensureSpace(rowHeight);
      this.drawTextAt(row, MARGIN, this.y, fontSize, { color: COLORS.muted });
      this.y -= rowHeight;
    }
  }

  drawDivider(): void {
    this.drawSpacer(6);
    this.ensureSpace(1);
    this.page.drawLine({
      start: { x: MARGIN, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN, y: this.y },
      thickness: 0.75,
      color: COLORS.border,
    });
    this.drawSpacer(10);
  }

  drawTableHeader(columns: TableColumn[]): void {
    const fontSize = 9;
    const rowHeight = this.lineHeight(fontSize) + 6;
    this.ensureSpace(rowHeight);

    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - rowHeight + 8,
      width: CONTENT_WIDTH,
      height: rowHeight,
      color: COLORS.headerBg,
    });

    let x = MARGIN + 6;
    for (const column of columns) {
      this.drawTextAt(column.label, x, this.y - 2, fontSize, {
        bold: true,
        maxWidth: column.width - 8,
        align: column.align ?? "left",
      });
      x += column.width;
    }

    this.y -= rowHeight + 2;
  }

  drawTableRow(
    cells: string[],
    columns: TableColumn[],
    options?: { bold?: boolean; alt?: boolean },
  ): void {
    const fontSize = 9;
    const rowHeight = this.lineHeight(fontSize);
    const wrappedCells = cells.map((cell, index) => {
      const width = (columns[index]?.width ?? 80) - 8;
      return this.wrapText(cell, width, fontSize, options?.bold);
    });
    const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
    const blockHeight = rowHeight * maxLines + 8;

    this.ensureSpace(blockHeight);

    if (options?.alt) {
      this.page.drawRectangle({
        x: MARGIN,
        y: this.y - blockHeight + 6,
        width: CONTENT_WIDTH,
        height: blockHeight,
        color: COLORS.rowAlt,
      });
    }

    let x = MARGIN + 6;
    wrappedCells.forEach((lines, index) => {
      const column = columns[index];
      const width = column?.width ?? 80;
      const align = column?.align ?? "left";

      lines.forEach((line, lineIndex) => {
        const lineY = this.y - lineIndex * rowHeight;
        this.drawTextAt(line, x, lineY, fontSize, {
          bold: options?.bold,
          maxWidth: width - 8,
          align,
        });
      });

      x += width;
    });

    this.y -= blockHeight;
  }

  drawTotals(rows: { label: string; value: string; bold?: boolean }[]): void {
    this.drawDivider();
    const labelX = PAGE_WIDTH - MARGIN - 210;
    const valueWidth = 90;

    for (const row of rows) {
      const fontSize = row.bold ? 11 : 10;
      const rowHeight = this.lineHeight(fontSize) + 2;
      this.ensureSpace(rowHeight);

      this.drawTextAt(row.label, labelX, this.y, fontSize, { bold: row.bold });
      this.drawTextAt(row.value, PAGE_WIDTH - MARGIN - valueWidth, this.y, fontSize, {
        bold: row.bold,
        maxWidth: valueWidth,
        align: "right",
      });
      this.y -= rowHeight;
    }
  }

  drawSignatureLine(label = "Signature"): void {
    this.drawSpacer(24);
    const fontSize = 10;
    const rowHeight = this.lineHeight(fontSize);
    this.ensureSpace(rowHeight + 18);

    this.drawTextAt(`${label} :`, MARGIN, this.y, fontSize, { color: COLORS.muted });
    this.page.drawLine({
      start: { x: MARGIN + 70, y: this.y - 2 },
      end: { x: MARGIN + 240, y: this.y - 2 },
      thickness: 0.75,
      color: COLORS.border,
    });
    this.y -= rowHeight + 12;
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}

export function formatMoney(amount: number, currencySymbol = "OMR"): string {
  return `${amount.toFixed(3)} ${currencySymbol}`;
}

export function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = date.getDate();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatInvoiceNumber(prefix: string, id: number): string {
  const trimmed = prefix.trim();
  return trimmed ? `${trimmed}${id}` : String(id);
}

export function buildItemDescription(
  productTitle: string | null,
  flavorName: string | null,
): string {
  const title = productTitle?.trim() || "—";
  const flavor = flavorName?.trim();
  return flavor ? `${title} — ${flavor}` : title;
}
