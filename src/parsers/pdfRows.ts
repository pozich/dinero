type PdfTextItem = { str: string; transform: number[] };

type PdfPageLike = {
  getTextContent(): Promise<{ items: unknown[] }>;
};

type PdfDocumentLike = {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPageLike>;
};

export type RowCell = { text: string; x: number };
export type Row = { page: number; y: number; cells: RowCell[] };

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

export async function extractPageRows(
  page: PdfPageLike,
  pageIndex: number,
): Promise<Row[]> {
  const content = await page.getTextContent();
  const byY = new Map<number, RowCell[]>();

  for (const item of content.items) {
    if (!isTextItem(item)) continue;
    const text = item.str;
    if (!text.trim()) continue;
    const x = Math.round(item.transform[4] * 10) / 10;
    const y = Math.round(item.transform[5] * 10) / 10;
    const cells = byY.get(y) ?? [];
    cells.push({ text, x });
    byY.set(y, cells);
  }

  const rows: Row[] = [];
  for (const [y, cells] of byY) {
    cells.sort((a, b) => a.x - b.x);
    rows.push({ page: pageIndex, y, cells });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows;
}

export async function extractDocumentRows(doc: PdfDocumentLike): Promise<Row[]> {
  const rows: Row[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    rows.push(...(await extractPageRows(page, i)));
  }
  return rows;
}

export function rowText(row: Row): string {
  return row.cells.map((c) => c.text).join(" ");
}
