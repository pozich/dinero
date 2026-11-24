import type { DbClient } from "./types";

export type DividendRow = {
  id: number;
  transactionId: number;
  isin: string;
  ticker: string | null;
  name: string | null;
  amountTiyin: number;
  occurredAt: string;
  perShareTiyin: number;
  taxRatePercent: number;
  quantityAtPayment: number;
};

type DividendDbRow = {
  id: number;
  transaction_id: number;
  security_isin: string;
  ticker: string | null;
  name: string | null;
  amount_tiyin: number;
  occurred_at: string;
  per_share_tiyin: number;
  tax_rate_percent: number;
  quantity_at_payment: number;
};

function fromRow(row: DividendDbRow): DividendRow {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    isin: row.security_isin,
    ticker: row.ticker,
    name: row.name,
    amountTiyin: row.amount_tiyin,
    occurredAt: row.occurred_at,
    perShareTiyin: row.per_share_tiyin,
    taxRatePercent: row.tax_rate_percent,
    quantityAtPayment: row.quantity_at_payment,
  };
}

// Left join — SPEC-2.md 9's real sample has a dividend-labeled payment
// under an ISIN outside the 7 seeded tickers (likely not even an equity
// dividend), so ticker/name must be allowed to come back null rather than
// dropping the row.
const SELECT_SQL = `
  SELECT d.id, d.transaction_id, d.security_isin, s.ticker, s.name,
         t.amount_tiyin, t.occurred_at, d.per_share_tiyin, d.tax_rate_percent, d.quantity_at_payment
  FROM dividends d
  JOIN transactions t ON t.id = d.transaction_id
  LEFT JOIN securities s ON s.isin = d.security_isin
`;

export async function listDividends(db: DbClient): Promise<DividendRow[]> {
  const rows = await db.select<DividendDbRow[]>(`${SELECT_SQL} ORDER BY t.occurred_at`);
  return rows.map(fromRow);
}

export async function listDividendsByIsin(db: DbClient, isin: string): Promise<DividendRow[]> {
  const rows = await db.select<DividendDbRow[]>(
    `${SELECT_SQL} WHERE d.security_isin = $1 ORDER BY t.occurred_at`,
    [isin],
  );
  return rows.map(fromRow);
}

export type InsertDividendInput = {
  transactionId: number;
  isin: string;
  perShareTiyin: number;
  taxRatePercent: number;
  quantityAtPayment: number;
};

export async function insertDividend(db: DbClient, input: InsertDividendInput): Promise<number> {
  const result = await db.execute(
    `INSERT INTO dividends (transaction_id, security_isin, per_share_tiyin, tax_rate_percent, quantity_at_payment)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.transactionId, input.isin, input.perShareTiyin, input.taxRatePercent, input.quantityAtPayment],
  );
  return result.lastInsertId!;
}

export async function dividendExistsForTransaction(db: DbClient, transactionId: number): Promise<boolean> {
  const rows = await db.select<{ id: number }[]>("SELECT id FROM dividends WHERE transaction_id = $1", [transactionId]);
  return rows.length > 0;
}
