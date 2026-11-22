import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ensurePdfWorker } from "./pdfjsWorker";
import { extractDocumentRows, type Row } from "./pdfRows";
import type { ParsedTransaction, TransactionSummary } from "./types";

export type ParsedBccStatement = {
  bank: "bcc";
  periodStart: string;
  periodEnd: string;
  transactions: ParsedTransaction[];
  summary: TransactionSummary;
};

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{2})$/;
const AMOUNT_RE = /^([+-]?)([\d.]+)\s*KZT$/;
const PERIOD_RE = /(\d{2}\.\d{2}\.\d{2})\s*-\s*(\d{2}\.\d{2}\.\d{2})/;
const STOP_RE = /^Vice President$/;
const DATE_COL: readonly [number, number] = [80, 95];
const DESCRIPTION_CONTINUATION_COL: readonly [number, number] = [185, 210];

function inCol(x: number, [min, max]: readonly [number, number]): boolean {
  return x >= min && x <= max;
}

function parseBccDate(token: string): string {
  const m = DATE_RE.exec(token);
  if (!m) throw new Error(`BCC: bad date "${token}"`);
  const [, dd, mm, yy] = m;
  return `20${yy}-${mm}-${dd}T00:00:00.000Z`;
}

function parseBccAmount(token: string): number {
  const m = AMOUNT_RE.exec(token.trim());
  if (!m) throw new Error(`BCC: bad amount "${token}"`);
  const [, sign, number] = m;
  const value = Math.round(Number(number) * 100);
  return sign === "-" ? -value : value;
}

function findSummaryRow(rows: Row[]): Row {
  const row = rows.find(
    (r) => r.cells.length === 4 && r.cells.every((c) => AMOUNT_RE.test(c.text)),
  );
  if (!row) throw new Error("BCC: balance summary row not found");
  return row;
}

export async function parseBcc(data: Uint8Array): Promise<ParsedBccStatement> {
  await ensurePdfWorker();
  const doc = await getDocument({ data, useWorkerFetch: false }).promise;
  const rows = await extractDocumentRows(doc);

  const headerText = rows.map((r) => r.cells.map((c) => c.text).join(" ")).join("\n");
  const periodMatch = PERIOD_RE.exec(headerText);
  if (!periodMatch) throw new Error("BCC: statement period not found");

  const [opening, credits, debits, closing] = findSummaryRow(rows).cells.map((c) =>
    parseBccAmount(c.text),
  );

  const transactions: ParsedTransaction[] = [];
  for (const row of rows) {
    if (row.cells[0] && STOP_RE.test(row.cells[0].text)) break;

    const [dateCell, descCell, amountCell] = row.cells;
    if (dateCell && DATE_RE.test(dateCell.text) && inCol(dateCell.x, DATE_COL)) {
      transactions.push({
        occurredAt: parseBccDate(dateCell.text),
        amountTiyin: parseBccAmount(amountCell.text),
        description: descCell.text,
        rawType: descCell.text,
      });
      continue;
    }

    const last = transactions[transactions.length - 1];
    if (!last) continue;
    const extra = row.cells
      .filter((c) => inCol(c.x, DESCRIPTION_CONTINUATION_COL))
      .map((c) => c.text)
      .join(" ");
    if (extra) {
      last.description = `${last.description} ${extra}`;
      last.rawType = last.description;
    }
  }

  return {
    bank: "bcc",
    periodStart: parseBccDate(periodMatch[1]),
    periodEnd: parseBccDate(periodMatch[2]),
    transactions,
    summary: {
      opening,
      closing,
      categories: { Credits: credits, Debits: -debits },
    },
  };
}
