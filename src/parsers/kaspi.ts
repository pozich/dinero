import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ensurePdfWorker } from "./pdfjsWorker";
import { extractDocumentRows, rowText, type Row } from "./pdfRows";
import type { ParsedStatement, ParsedTransaction, TransactionSummary } from "./types";

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{2})$/;
const AMOUNT_RE = /^([+-])\s*([\d\s]+),(\d{2})\s*₸$/;
const FOREIGN_RE = /^\(([+-])\s*([\d\s.,]+)\s*(USD|EUR)\)$/;
const PERIOD_RE = /period from (\d{2}\.\d{2}\.\d{2}) to (\d{2}\.\d{2}\.\d{2})/;
const HEADER_RE = /^Date\s+Amount\s+Transaction\s+Details$/;
const SUMMARY_START_RE = /^Transaction summary:/;

// Order matters only for readability; matching is by exact label text.
const SUMMARY_LABELS = [
  "Replenishment",
  "Receipts from your accounts",
  "Credit proceeds",
  "Transfers",
  "Transfers to your accounts",
  "Purchases",
  "Withdrawals",
  "Others",
];

const STOP_MARKERS = [
  "The amount is blocked",
  "The section “Transaction summary”",
];

function parseKaspiDate(token: string): string {
  const m = DATE_RE.exec(token);
  if (!m) throw new Error(`Kaspi: bad date "${token}"`);
  const [, dd, mm, yy] = m;
  return `20${yy}-${mm}-${dd}T00:00:00.000Z`;
}

function parseKaspiAmount(token: string): number {
  const m = AMOUNT_RE.exec(token.trim());
  if (!m) throw new Error(`Kaspi: bad amount "${token}"`);
  const [, sign, intPart, fracPart] = m;
  const digits = intPart.replace(/\s/g, "");
  const value = Number(digits) * 100 + Number(fracPart);
  return sign === "-" ? -value : value;
}

function parseSummary(rows: Row[]): TransactionSummary {
  let opening = 0;
  let closing = 0;
  const categories: Record<string, number> = {};
  let sawOpening = false;

  for (const row of rows) {
    const [first, second] = row.cells;
    if (!first || !second) continue;

    if (first.text.startsWith("Card balance")) {
      const amount = parseKaspiAmount(second.text);
      if (!sawOpening) {
        opening = amount;
        sawOpening = true;
      } else {
        closing = amount;
      }
      continue;
    }

    const label = SUMMARY_LABELS.find((l) => first.text.trim() === l);
    if (label) categories[label] = parseKaspiAmount(second.text);
  }

  return { opening, closing, categories };
}

function parseTransactions(rows: Row[]): ParsedTransaction[] {
  const out: ParsedTransaction[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (STOP_MARKERS.some((m) => rowText(row).includes(m))) break;

    const [dateCell, amountCell, typeCell, ...detailCells] = row.cells;
    if (!dateCell || !DATE_RE.test(dateCell.text)) continue; // page chrome / header repeat

    const occurredAt = parseKaspiDate(dateCell.text);
    const amountTiyin = parseKaspiAmount(amountCell.text);
    let rawType = typeCell.text;
    const description = detailCells.map((c) => c.text).join(" ");

    // "Receipt from your" / "Transfer to your" wraps: the word "account" lands
    // alone on the next physical row.
    const next = rows[i + 1];
    if (next && next.cells.length === 1 && next.cells[0].text === "account") {
      rawType = `${rawType} account`;
      i++;
    }

    const txn: ParsedTransaction = { occurredAt, amountTiyin, description, rawType };

    // A currency sub-line belongs to the transaction above it, not a new one.
    const after = rows[i + 1];
    const foreignMatch =
      after && after.cells.length === 1 ? FOREIGN_RE.exec(after.cells[0].text) : null;
    if (foreignMatch) {
      const [, sign, amountStr, currency] = foreignMatch;
      const normalized = Number(amountStr.replace(/\s/g, "").replace(",", "."));
      txn.foreignAmount = {
        currency,
        amountMinor: Math.round((sign === "-" ? -normalized : normalized) * 100),
      };
      i++;
    }

    out.push(txn);
  }

  return out;
}

export async function parseKaspi(data: Uint8Array): Promise<ParsedStatement> {
  await ensurePdfWorker();
  const doc = await getDocument({ data, useWorkerFetch: false }).promise;
  const rows = await extractDocumentRows(doc);

  const fullText = rows.map(rowText).join("\n");
  const periodMatch = PERIOD_RE.exec(fullText);
  if (!periodMatch) throw new Error("Kaspi: statement period not found");

  const headerIndex = rows.findIndex((r) => HEADER_RE.test(rowText(r)));
  if (headerIndex === -1) throw new Error("Kaspi: transaction table header not found");

  const summaryStartIndex = rows.findIndex((r) => SUMMARY_START_RE.test(rowText(r)));
  if (summaryStartIndex === -1) throw new Error("Kaspi: \"Transaction summary\" block not found");

  const summary = parseSummary(rows.slice(summaryStartIndex, headerIndex));
  const transactions = parseTransactions(rows.slice(headerIndex + 1));

  return {
    bank: "kaspi",
    periodStart: parseKaspiDate(periodMatch[1]),
    periodEnd: parseKaspiDate(periodMatch[2]),
    transactions,
    summary,
  };
}
