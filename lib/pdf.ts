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

export function pdfResponse(title: string, bytes: Buffer) {
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${title.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
