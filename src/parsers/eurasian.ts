import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ensurePdfWorker } from "./pdfjsWorker";
import { extractDocumentRows, type Row } from "./pdfRows";
import type { ParsedTransaction, TransactionSummary } from "./types";

export type ParsedEurasianStatement = {
  bank: "eurasian";
  periodStart: string;
  periodEnd: string;
  transactions: ParsedTransaction[];
  summary: TransactionSummary;
};

// The source PDF has broken "ti" ligatures (shown as a stray \u0000), e.g.
// "Account statement" -> "Account statement:" / "transac\u0000on". We never
// match on these words — only on dates, amounts and column x-positions
// (SPEC.md 4.2: "парсер не должен зависеть от этих слов").
const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const TIME_RE = /^\d{2}:\d{2}:\d{2}$/;
const PERIOD_RE = /Period\s*:\s*(\d{2}\.\d{2}\.\d{4})\s*-\s*(\d{2}\.\d{2}\.\d{4})/;
const STOP_RE = /^Available on \d{2}\.\d{2}\.\d{4}\s*:/;
const LEFT_COL: readonly [number, number] = [20, 45];

// Column x-anchors are stable across the whole document (a monospaced
// template); see the row dumps used to derive them.
const COLS = {
  type: [130, 160],
  details: [245, 280],
  signedAmount: [585, 610],
} as const;

function inCol(x: number, [min, max]: readonly [number, number]): boolean {
  return x >= min && x <= max;
}

function parseEurasianDate(token: string): string {
  const m = DATE_RE.exec(token);
  if (!m) throw new Error(`Eurasian: bad date "${token}"`);
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
}

function parseEurasianAmount(token: string): number {
  const cleaned = token.replace(/\s|₸/g, "");
  const m = /^([+-]?)(\d+)$/.exec(cleaned);
  if (!m) throw new Error(`Eurasian: bad amount "${token}"`);
  const [, sign, digits] = m;
  const value = Number(digits) * 100;
  return sign === "-" ? -value : value;
}

function findLabelValue(rows: Row[], label: string): number {
  for (const row of rows) {
    if (row.cells[0]?.text === label && row.cells[1]) {
      return parseEurasianAmount(row.cells[1].text);
    }
  }
  throw new Error(`Eurasian: "${label}" not found`);
}

function findAvailableOnValues(rows: Row[]): { opening: number; closing: number } {
  const matches = rows
    .filter((r) => r.cells[0]?.text.startsWith("Available on ") && r.cells[1])
    .map((r) => parseEurasianAmount(r.cells[1].text));
  if (matches.length < 2) throw new Error("Eurasian: opening/closing balance not found");
  return { opening: matches[0], closing: matches[1] };
}

type Building = {
  date: string;
  typeFragments: string[];
  details?: string;
  signedAmount?: number;
};

function flush(b: Building): ParsedTransaction {
  if (b.signedAmount === undefined) {
    throw new Error(`Eurasian: transaction on ${b.date} has no amount`);
  }
  return {
    occurredAt: b.date,
    amountTiyin: b.signedAmount,
    description: b.details ?? "",
    rawType: b.typeFragments.join(" "),
  };
}

function parseTransactions(rows: Row[]): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];
  let current: Building | null = null;
  let availableOnMarkers = 0;

  for (const row of rows) {
    if (row.cells.length === 1 && STOP_RE.test(row.cells[0].text)) {
      availableOnMarkers++;
      if (availableOnMarkers >= 2) break; // closing-balance echo: end of table
      continue; // opening-balance echo at the top of the table
    }

    for (const cell of row.cells) {
      if (DATE_RE.test(cell.text) && inCol(cell.x, LEFT_COL)) {
        if (current) out.push(flush(current));
        current = { typeFragments: [], date: parseEurasianDate(cell.text) };
        continue;
      }
      if (!current) continue;
      if (TIME_RE.test(cell.text) && inCol(cell.x, LEFT_COL)) continue;
      if (inCol(cell.x, COLS.type)) current.typeFragments.push(cell.text);
      else if (inCol(cell.x, COLS.details)) current.details = cell.text;
      else if (inCol(cell.x, COLS.signedAmount)) {
        current.signedAmount = parseEurasianAmount(cell.text);
      }
    }
  }
  if (current) out.push(flush(current));
  return out;
}

export async function parseEurasian(data: Uint8Array): Promise<ParsedEurasianStatement> {
  await ensurePdfWorker();
  const doc = await getDocument({ data, useWorkerFetch: false }).promise;
  const rows = await extractDocumentRows(doc);

  const headerRows = rows.filter((r) => r.page === 1);
  const headerText = headerRows.map((r) => r.cells.map((c) => c.text).join(" ")).join("\n");

  const periodMatch = PERIOD_RE.exec(headerText);
  if (!periodMatch) throw new Error("Eurasian: statement period not found");

  const { opening, closing } = findAvailableOnValues(headerRows);
  const arrival = findLabelValue(headerRows, "Arrival for the period");
  const expense = findLabelValue(headerRows, "Expense for the period");

  const transactions = parseTransactions(rows.filter((r) => r.page >= 2));

  return {
    bank: "eurasian",
    periodStart: parseEurasianDate(periodMatch[1]),
    periodEnd: parseEurasianDate(periodMatch[2]),
    transactions,
    summary: {
      opening,
      closing,
      categories: { Arrival: arrival, Expense: expense },
    } satisfies TransactionSummary,
  };
}
