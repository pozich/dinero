import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractDocumentRows, rowText, type Row } from "./pdfRows";
import type { ParsedTransaction, TransactionSummary } from "./types";

export type HalykAccountKind = "halyk_salary" | "halyk_standard";

export type FeeLink = { parentIndex: number; feeIndex: number };

export type ParsedHalykStatement = {
  bank: "halyk";
  accountKind: HalykAccountKind;
  periodStart: string;
  periodEnd: string;
  transactions: ParsedTransaction[];
  fees: ParsedTransaction[];
  feeLinks: FeeLink[];
  summary: TransactionSummary;
};

const DATE_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const AMOUNT_RE = /^([+-]?)\s*([\d\s]+),(\d{2})$/;
const PERIOD_RE = /Период выписки: с (\d{2}\.\d{2}\.\d{4}) по (\d{2}\.\d{2}\.\d{4})/;
const DESCRIPTION_COLUMN_MAX_X = 250;

function parseHalykDate(token: string): string {
  const m = DATE_RE.exec(token);
  if (!m) throw new Error(`Halyk: bad date "${token}"`);
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}T00:00:00.000Z`;
}

function parseHalykAmount(token: string): number {
  const m = AMOUNT_RE.exec(token.trim());
  if (!m) throw new Error(`Halyk: bad amount "${token}"`);
  const [, sign, intPart, fracPart] = m;
  const digits = intPart.replace(/\s/g, "");
  const value = Number(digits) * 100 + Number(fracPart);
  return sign === "-" ? -value : value;
}

function isHeaderStart(row: Row): boolean {
  return row.cells[0]?.text === "Дата" && row.cells[1]?.text === "Дата";
}

function isFooter(row: Row): boolean {
  return row.cells[0]?.text.startsWith("Выписка по счету:") ?? false;
}

function isStopMarker(row: Row): boolean {
  return row.cells[0]?.text === "Место печати Банка";
}

/** "Всего:" is either one row with the 3 totals (single-currency account) or
 * a label row followed by a "KZT + 3 totals" row (multi-currency account). */
function parseTotalsRow(
  rows: Row[],
  startIndex: number,
): { categories: Record<string, number>; nextIndex: number } {
  const row = rows[startIndex];
  if (row.cells.length >= 4) {
    const [, prihod, raskhod, komissiya] = row.cells;
    return {
      categories: {
        Приход: parseHalykAmount(prihod.text),
        Расход: parseHalykAmount(raskhod.text),
        Комиссия: parseHalykAmount(komissiya.text),
      },
      nextIndex: startIndex + 1,
    };
  }
  const next = rows[startIndex + 1];
  const [, prihod, raskhod, komissiya] = next.cells;
  return {
    categories: {
      Приход: parseHalykAmount(prihod.text),
      Расход: parseHalykAmount(raskhod.text),
      Комиссия: parseHalykAmount(komissiya.text),
    },
    nextIndex: startIndex + 2,
  };
}

function parseBalance(headerText: string, label: string): number {
  const re = new RegExp(`${label}:\\s*([\\d\\s]+,\\d{2})`);
  const m = re.exec(headerText);
  if (!m) throw new Error(`Halyk: "${label}" not found`);
  return parseHalykAmount(m[1]);
}

export async function parseHalyk(data: Uint8Array): Promise<ParsedHalykStatement> {
  const doc = await getDocument({ data, useWorkerFetch: false }).promise;
  const rows = await extractDocumentRows(doc);

  const headerStartIndex = rows.findIndex(isHeaderStart);
  if (headerStartIndex === -1) throw new Error("Halyk: table header not found");

  const headerText = rows
    .slice(0, headerStartIndex)
    .map(rowText)
    .join("\n");

  const periodMatch = PERIOD_RE.exec(headerText);
  if (!periodMatch) throw new Error("Halyk: statement period not found");

  const accountKind: HalykAccountKind = headerText.includes("«Стандарт»")
    ? "halyk_standard"
    : "halyk_salary";

  const opening = parseBalance(headerText, "Входящий остаток");
  const closing = parseBalance(headerText, "Исходящий остаток");

  // header block is always exactly 5 lines, then (on the first page only) a
  // "Всего:" totals block before the real transaction rows start.
  let cursor = headerStartIndex + 5;
  let categories: Record<string, number> = {};
  if (rows[cursor]?.cells[0]?.text === "Всего:") {
    const parsed = parseTotalsRow(rows, cursor);
    categories = parsed.categories;
    cursor = parsed.nextIndex;
  }

  const transactions: ParsedTransaction[] = [];
  const fees: ParsedTransaction[] = [];
  const feeLinks: FeeLink[] = [];

  for (let i = cursor; i < rows.length; i++) {
    const row = rows[i];
    if (isStopMarker(row)) break;
    if (isHeaderStart(row)) {
      i += 4; // skip the rest of the repeated 5-line header block
      continue;
    }
    if (isFooter(row)) continue;

    const [dateProv, , descCell, , , prihod, raskhod, komissiya] = row.cells;
    if (!dateProv || !DATE_RE.test(dateProv.text)) {
      // description/account-number continuation of the previous transaction
      const last = transactions[transactions.length - 1];
      if (last) {
        const extra = row.cells
          .filter((c) => c.x < DESCRIPTION_COLUMN_MAX_X)
          .map((c) => c.text)
          .join(" ");
        if (extra) last.description = `${last.description} ${extra}`;
      }
      continue;
    }

    const occurredAt = parseHalykDate(dateProv.text);
    const amountTiyin = parseHalykAmount(prihod.text) + parseHalykAmount(raskhod.text);
    const description = descCell.text;

    transactions.push({
      occurredAt,
      amountTiyin,
      description,
      rawType: description,
    });

    const feeTiyin = parseHalykAmount(komissiya.text);
    if (feeTiyin !== 0) {
      fees.push({
        occurredAt,
        amountTiyin: feeTiyin,
        description: `Комиссия: ${description}`,
        rawType: "Комиссия",
      });
      feeLinks.push({ parentIndex: transactions.length - 1, feeIndex: fees.length - 1 });
    }
  }

  return {
    bank: "halyk",
    accountKind,
    periodStart: parseHalykDate(periodMatch[1]),
    periodEnd: parseHalykDate(periodMatch[2]),
    transactions,
    fees,
    feeLinks,
    summary: { opening, closing, categories },
  };
}
