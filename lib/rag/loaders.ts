import { getFileBuffer } from "@/lib/supabase/storage";

export async function loadDocument(
  storagePath: string,
  fileType: string
): Promise<string> {
  const buffer = await getFileBuffer(storagePath);

  switch (fileType) {
    case "pdf":
      return loadPdf(Buffer.from(buffer));
    case "txt":
    case "md":
      return new TextDecoder().decode(buffer);
    case "docx":
      return loadDocx(Buffer.from(buffer));
    case "xlsx":
      return loadXlsx(Buffer.from(buffer));
    default:
      return new TextDecoder().decode(buffer);
  }
}

async function loadPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text;
}

async function loadDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function loadXlsx(buffer: Buffer): Promise<string> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const texts: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    texts.push(`--- Sheet: ${sheetName} ---\n${csv}`);
  }

  return texts.join("\n\n");
}

export async function loadUrl(url: string): Promise<string> {
  const response = await fetch(url);
  const html = await response.text();
  const cheerio = await import("cheerio");
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header").remove();

  return $("body").text().replace(/\s+/g, " ").trim();
}
