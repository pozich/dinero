// SPEC-2.md 9.1's new parser: the HTML "Выписка с лицевого счета" snapshot
// (samples/Halyk/snapshots/*.html). Verified against real files with
// Python first (not guessed) — each holding row is [index, issuer name,
// address, ISIN, bond maturity date, quantity (Основной), quantity
// (Блокирование), quantity (Репо), quantity (Обременение), ...], found by
// splitting on <tr>/<td> rather than scanning raw character offsets (an
// early slice-based attempt attributed one row's issuer name to the wrong
// ISIN — this column-aware version doesn't have that bug).
//
// Deliberately never reads the "Сведения о держателе ценных бумаг" header
// block (ФИО, ИИН) — this parser only ever looks inside the holdings
// table, so there's nothing here that could extract or store it.

export type SecurityHolding = { isin: string; quantity: number };
export type ParsedSnapshot = { snapshotDate: string; holdings: SecurityHolding[] };

const SNAPSHOT_DATE_RE = /по состоянию на (\d{2})\.(\d{2})\.(\d{4})/u;
const ROW_SPLIT_RE = /<tr[^>]*>/gi;
const CELL_RE = /<td[^>]*>([\s\S]*?)<\/td>/gi;
const ISIN_RE = /^[A-Z]{2}[0-9A-Z]{10}$/;

function cellText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseHalykSnapshot(html: string): ParsedSnapshot {
  const dateMatch = SNAPSHOT_DATE_RE.exec(html);
  if (!dateMatch) throw new Error("Дата снимка не найдена");
  const [, day, month, year] = dateMatch;
  const snapshotDate = `${year}-${month}-${day}T00:00:00.000Z`;

  const holdings: SecurityHolding[] = [];
  for (const row of html.split(ROW_SPLIT_RE)) {
    const cells = [...row.matchAll(CELL_RE)].map((m) => cellText(m[1]));
    if (cells.length < 6) continue;
    const isin = cells[3];
    if (!ISIN_RE.test(isin)) continue;
    const quantity = Number(cells[5]);
    if (!Number.isFinite(quantity)) continue;
    holdings.push({ isin, quantity });
  }

  return { snapshotDate, holdings };
}
