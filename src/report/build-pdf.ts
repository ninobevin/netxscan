import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { CompanyLogoBytes } from '../company/logo';
import type { ReportPreview, ReportTableColumn } from '../shared/report-types';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const INK = rgb(0.08, 0.16, 0.16);
const LINE = rgb(0.75, 0.8, 0.8);
const HEADER_BG = rgb(0.08, 0.31, 0.29);
const HEADER_FG = rgb(1, 1, 1);
const ROW_ALT = rgb(0.96, 0.97, 0.97);
const TABLE_WIDTH = PAGE_WIDTH - MARGIN * 2;

function wrap(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  const pushWord = (word: string) => {
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
        return;
      }
      if (current) {
        lines.push(current);
      }
      current = word;
      return;
    }
    if (current) {
      lines.push(current);
      current = '';
    }
    let chunk = '';
    for (const char of word) {
      const next = chunk + char;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        chunk = next;
      } else {
        if (chunk) {
          lines.push(chunk);
        }
        chunk = char;
      }
    }
    current = chunk;
  };
  for (const word of words) {
    pushWord(word);
  }
  if (current) {
    lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function colWidths(columns: ReportTableColumn[]): number[] {
  const n = Math.max(columns.length, 1);
  const base = Math.floor(TABLE_WIDTH / n);
  const widths = columns.map(() => base);
  widths[widths.length - 1] += TABLE_WIDTH - base * n;
  return widths;
}

export async function buildReportPdf(preview: ReportPreview, company: {
  name: string;
  address: string;
  logo?: CompanyLogoBytes | null;
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensure = (need: number) => {
    if (y - need < MARGIN + (preview.showSignature ? 110 : 40)) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  let logoHeight = 0;
  if (company.logo) {
    const image =
      company.logo.kind === 'png'
        ? await doc.embedPng(company.logo.bytes)
        : await doc.embedJpg(company.logo.bytes);
    const maxH = 48;
    const maxW = 90;
    const scale = Math.min(maxH / image.height, maxW / image.width, 1);
    const width = image.width * scale;
    const height = image.height * scale;
    logoHeight = height;
    page.drawImage(image, {
      x: PAGE_WIDTH - MARGIN - width,
      y: y - height + 4,
      width,
      height,
    });
  }

  const name = company.name.trim() || 'Company';
  page.drawText(name, { x: MARGIN, y: y - 14, size: 16, font: bold, color: INK });
  y -= 22;
  if (company.address.trim()) {
    page.drawText(company.address.trim(), { x: MARGIN, y: y - 10, size: 10, font, color: INK });
    y -= 16;
  }
  if (logoHeight > 22) {
    y -= logoHeight - 22;
  }
  page.drawText(preview.title, { x: MARGIN, y: y - 10, size: 11, font: bold, color: INK });
  y -= 16;
  const subtitle =
    preview.kind === 'assets'
      ? ''
      : preview.subtitle
          .split('\n')
          .filter((line) => {
            const text = line.trim().toLowerCase();
            if (!text) {
              return false;
            }
            const address = company.address.trim().toLowerCase();
            const clinic = name.toLowerCase();
            if (address && text.includes(address)) {
              return false;
            }
            if (clinic && (text === clinic || text.startsWith(`${clinic} ·`))) {
              return false;
            }
            return true;
          });
  for (const line of subtitle) {
    page.drawText(line, { x: MARGIN, y: y - 9, size: 9, font, color: INK });
    y -= 13;
  }
  y -= 6;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: HEADER_BG,
  });
  y -= 18;

  const rowPad = 5;
  const fontSize = 8;

  if (preview.sections.length === 0 || preview.sections.every((section) => section.rows.length === 0)) {
    page.drawText('No rows for this report.', { x: MARGIN, y, size: 10, font, color: INK });
    y -= 24;
  }

  for (const section of preview.sections) {
    if (section.heading) {
      ensure(36);
      page.drawText(section.heading, { x: MARGIN, y, size: 10, font: bold, color: INK });
      y -= 14;
    }
    const widths = colWidths(section.columns);
    const drawHeaderRow = () => {
      let x = MARGIN;
      page.drawRectangle({
        x: MARGIN,
        y: y - 16,
        width: TABLE_WIDTH,
        height: 16,
        color: HEADER_BG,
      });
      section.columns.forEach((col, index) => {
        page.drawText(col.label, {
          x: x + 4,
          y: y - 11,
          size: fontSize,
          font: bold,
          color: HEADER_FG,
        });
        x += widths[index];
      });
      y -= 16;
    };
    ensure(24);
    drawHeaderRow();
    section.rows.forEach((row, index) => {
      const cellLines = section.columns.map((col, colIndex) =>
        wrap(String(row[col.key] || '—'), font, fontSize, widths[colIndex] - 8),
      );
      const lineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
      const rowHeight = lineCount * 10 + rowPad * 2;
      ensure(rowHeight + 8);
      if (index % 2 === 1) {
        page.drawRectangle({
          x: MARGIN,
          y: y - rowHeight,
          width: TABLE_WIDTH,
          height: rowHeight,
          color: ROW_ALT,
        });
      }
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: TABLE_WIDTH,
        height: rowHeight,
        borderColor: LINE,
        borderWidth: 0.5,
      });
      let x = MARGIN;
      section.columns.forEach((_col, colIndex) => {
        cellLines[colIndex].forEach((line, lineIndex) => {
          page.drawText(line, {
            x: x + 4,
            y: y - rowPad - 8 - lineIndex * 10,
            size: fontSize,
            font,
            color: INK,
          });
        });
        x += widths[colIndex];
      });
      y -= rowHeight;
    });
    y -= 14;
  }

  if (preview.showSignature) {
    ensure(110);
    y -= 12;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: LINE,
    });
    y -= 22;
    const signerName = preview.preparedBy.fullName.trim() || 'IT incharge';
    page.drawText(`Prepared by: ${signerName}`, { x: MARGIN, y, size: 10, font: bold, color: INK });
    y -= 16;
    if (preview.preparedBy.position.trim()) {
      page.drawText(preview.preparedBy.position.trim(), { x: MARGIN, y, size: 9, font, color: INK });
      y -= 16;
    }
    page.drawText('Signature', { x: MARGIN, y, size: 9, font, color: INK });
    page.drawLine({
      start: { x: MARGIN + 58, y: y - 1 },
      end: { x: MARGIN + 240, y: y - 1 },
      thickness: 0.8,
      color: INK,
    });
    page.drawText('Date', { x: MARGIN + 270, y, size: 9, font, color: INK });
    page.drawLine({
      start: { x: MARGIN + 298, y: y - 1 },
      end: { x: MARGIN + 420, y: y - 1 },
      thickness: 0.8,
      color: INK,
    });
  }

  return doc.save();
}
