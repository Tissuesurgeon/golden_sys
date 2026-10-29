import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export async function renderPdf(title: string, lines: string[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;

  function nextPage() {
    page = doc.addPage([595, 842]);
    y = 800;
  }

  function write(text: string, options: { size?: number; font?: PDFFont; x?: number; color?: ReturnType<typeof rgb> }) {
    const size = options.size ?? 11;
    const used = options.font ?? font;
    const x = options.x ?? 48;
    const width = 500;
    const words = text.split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let current = "";
    for (const word of words.length ? words : [""]) {
      const candidate = current ? `${current} ${word}` : word;
      if (used.widthOfTextAtSize(candidate, size) > width && current) {
        rows.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) rows.push(current);
    for (const row of rows.length ? rows : [""]) {
      if (y < 48) nextPage();
      page.drawText(row, { x, y, size, font: used, color: options.color ?? rgb(0.1, 0.12, 0.16) });
      y -= size + 6;
    }
  }

  try {
    const logo = await readFile(path.join(process.cwd(), "public/images/golden-child-school-logo.jpg"));
    const image = await doc.embedJpg(logo);
    page.drawImage(image, { x: 48, y: 760, width: 48, height: 48 });
  } catch {
    // The crest is optional when the file cannot be read.
  }
  page.drawText("Golden Child School", { x: 108, y: 788, size: 16, font: bold, color: rgb(0.06, 0.18, 0.39) });
  y = 730;
  write(title, { size: 14, font: bold, color: rgb(0.06, 0.18, 0.39) });
  y -= 6;
  for (const line of lines) write(line, { size: 11 });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export type SchoolHeading = { name: string; address: string; phone: string; email: string };
export type PdfTable = {
  title: string;
  lines: string[];
  rows: { label: string; value: string; bold?: boolean }[];
  after?: string[];
};

export async function renderSchoolPdf(school: SchoolHeading, tables: PdfTable[]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595, 842]);
  let y = 800;
  let logo: Awaited<ReturnType<PDFDocument["embedJpg"]>> | null = null;
  try {
    const bytes = await readFile(path.join(process.cwd(), "public/images/golden-child-school-logo.jpg"));
    logo = await doc.embedJpg(bytes);
  } catch {
    logo = null;
  }

  function header() {
    if (logo) page.drawImage(logo, { x: 48, y: 760, width: 48, height: 48 });
    page.drawText(school.name, { x: 108, y: 792, size: 16, font: bold, color: rgb(0.06, 0.18, 0.39) });
    const contact = [school.address, [school.phone, school.email].filter(Boolean).join(" · ")].filter(Boolean);
    let contactY = 774;
    for (const line of contact) {
      page.drawText(line, { x: 108, y: contactY, size: 9, font, color: rgb(0.3, 0.33, 0.38) });
      contactY -= 12;
    }
    y = 730;
  }

  function nextPage() {
    page = doc.addPage([595, 842]);
    header();
  }

  function wrap(text: string, used: PDFFont, size: number, width: number) {
    const words = text.split(/\s+/).filter(Boolean);
    const rows: string[] = [];
    let current = "";
    for (const word of words.length ? words : [""]) {
      const candidate = current ? `${current} ${word}` : word;
      if (used.widthOfTextAtSize(candidate, size) > width && current) {
        rows.push(current);
        current = word;
      } else current = candidate;
    }
    if (current) rows.push(current);
    return rows.length ? rows : [""];
  }

  function write(text: string, options?: { size?: number; font?: PDFFont; bold?: boolean }) {
    const size = options?.size ?? 11;
    const used = options?.font ?? (options?.bold ? bold : font);
    for (const row of wrap(text, used, size, 500)) {
      if (y < 56) nextPage();
      page.drawText(row, { x: 48, y, size, font: used, color: rgb(0.1, 0.12, 0.16) });
      y -= size + 5;
    }
  }

  header();
  tables.forEach((table, index) => {
    if (index > 0) nextPage();
    write(table.title, { size: 14, font: bold });
    y -= 4;
    for (const line of table.lines) write(line, { size: 11 });
    y -= 6;
    for (const row of table.rows) {
      const used = row.bold ? bold : font;
      const valueWidth = used.widthOfTextAtSize(row.value, 11);
      const labelRows = wrap(row.label, used, 11, 480 - valueWidth);
      labelRows.forEach((label, labelIndex) => {
        if (y < 56) nextPage();
        page.drawText(label, { x: 48, y, size: 11, font: used, color: rgb(0.1, 0.12, 0.16) });
        if (labelIndex === 0) page.drawText(row.value, { x: 545 - valueWidth, y, size: 11, font: used, color: rgb(0.1, 0.12, 0.16) });
        y -= 16;
      });
    }
    y -= 8;
    for (const line of table.after ?? []) write(line, { size: 11 });
  });
  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export function pdfResponse(title: string, bytes: Buffer) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${title.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
