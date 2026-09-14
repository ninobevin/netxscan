import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { ReportDomainSection } from '../shared/report-types';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;
const INK = rgb(0.08, 0.16, 0.16);
const LINE = rgb(0.75, 0.8, 0.8);
const HEADER_BG = rgb(0.08, 0.31, 0.29);
const HEADER_FG = rgb(1, 1, 1);
const ROW_ALT = rgb(0.96, 0.97, 0.97);

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

export async function buildCompliancePdf(input: {
  companyName: string;
  companyAddress: string;
  domains: ReportDomainSection[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensure = (need: number) => {
    if (y - need < MARGIN + 90) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const name = input.companyName.trim() || 'Company';
  const address = input.companyAddress.trim();
  page.drawText(name, { x: MARGIN, y: y - 14, size: 16, font: bold, color: INK });
  y -= 22;
  if (address) {
    page.drawText(address, { x: MARGIN, y: y - 10, size: 10, font, color: INK });
    y -= 18;
  }
  y -= 8;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 1,
    color: HEADER_BG,
  });
  y -= 22;

  const cols = [
    { key: 'hostname' as const, label: 'Unit', width: 108 },
    { key: 'ipv4' as const, label: 'IP', width: 88 },
    { key: 'device' as const, label: 'Device', width: 100 },
    { key: 'location' as const, label: 'Location', width: 88 },
    { key: 'findings' as const, label: 'Findings', width: 115 },
  ];
  const tableWidth = cols.reduce((sum, col) => sum + col.width, 0);
  const rowPad = 5;
  const fontSize = 8;

  const drawHeaderRow = () => {
    let x = MARGIN;
    page.drawRectangle({
      x: MARGIN,
      y: y - 16,
      width: tableWidth,
      height: 16,
      color: HEADER_BG,
    });
    for (const col of cols) {
      page.drawText(col.label, {
        x: x + 4,
        y: y - 11,
        size: fontSize,
        font: bold,
        color: HEADER_FG,
      });
      x += col.width;
    }
    y -= 16;
  };

  if (input.domains.length === 0) {
    page.drawText('No units with findings.', { x: MARGIN, y, size: 10, font, color: INK });
    y -= 24;
  }

  for (const section of input.domains) {
    ensure(36);
    page.drawText(section.domain, { x: MARGIN, y, size: 12, font: bold, color: INK });
    y -= 18;
    for (const control of section.controls) {
      ensure(40);
      page.drawText(`${control.controlId}  ${control.title}`, {
        x: MARGIN,
        y,
        size: 10,
        font: bold,
        color: INK,
      });
      y -= 14;
      drawHeaderRow();
      control.units.forEach((unit, index) => {
        const cellLines = cols.map((col) =>
          wrap(String(unit[col.key] || '—'), font, fontSize, col.width - 8),
        );
        const lineCount = Math.max(...cellLines.map((lines) => lines.length), 1);
        const rowHeight = lineCount * 10 + rowPad * 2;
        ensure(rowHeight + 8);
        if (index % 2 === 1) {
          page.drawRectangle({
            x: MARGIN,
            y: y - rowHeight,
            width: tableWidth,
            height: rowHeight,
            color: ROW_ALT,
          });
        }
        page.drawRectangle({
          x: MARGIN,
          y: y - rowHeight,
          width: tableWidth,
          height: rowHeight,
          borderColor: LINE,
          borderWidth: 0.5,
        });
        let x = MARGIN;
        cols.forEach((col, colIndex) => {
          cellLines[colIndex].forEach((line, lineIndex) => {
            page.drawText(line, {
              x: x + 4,
              y: y - rowPad - 8 - lineIndex * 10,
              size: fontSize,
              font,
              color: INK,
            });
          });
          x += col.width;
        });
        y -= rowHeight;
      });
      y -= 12;
    }
    y -= 8;
  }

  ensure(72);
  y -= 12;
  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_WIDTH - MARGIN, y },
    thickness: 0.5,
    color: LINE,
  });
  y -= 22;
  page.drawText('IT assigned', { x: MARGIN, y, size: 10, font: bold, color: INK });
  y -= 28;
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

  return doc.save();
}
