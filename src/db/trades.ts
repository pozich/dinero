import type { DbClient } from "./types";

export type TradeSide = "buy" | "sell";

export type TradeRow = {
  id: number;
  transactionId: number;
  isin: string;
  ticker: string;
  side: TradeSide;
  amountTiyin: number;
  occurredAt: string;
  orderNumber: string | null;
  commissionTiyin: number;
  estimatedQuantity: number | null;
};

type TradeDbRow = {
  id: number;
  transaction_id: number;
  security_isin: string;
  ticker: string;
  side: TradeSide;
  amount_tiyin: number;
  occurred_at: string;
  order_number: string | null;
  commission_tiyin: number;
  estimated_quantity: number | null;
};

function fromRow(row: TradeDbRow): TradeRow {
  return {
    id: row.id,
    transactionId: row.transaction_id,
    isin: row.security_isin,
    ticker: row.ticker,
    side: row.side,
    amountTiyin: row.amount_tiyin,
    occurredAt: row.occurred_at,
    orderNumber: row.order_number,
    commissionTiyin: row.commission_tiyin,
    estimatedQuantity: row.estimated_quantity,
  };
}

const SELECT_SQL = `
  SELECT tr.id, tr.transaction_id, tr.security_isin, s.ticker, tr.side, tr.amount_tiyin,
         t.occurred_at, tr.order_number, tr.commission_tiyin, tr.estimated_quantity
  FROM trades tr
  JOIN transactions t ON t.id = tr.transaction_id
  JOIN securities s ON s.isin = tr.security_isin
`;

export async function listTrades(db: DbClient): Promise<TradeRow[]> {
  const rows = await db.select<TradeDbRow[]>(`${SELECT_SQL} ORDER BY t.occurred_at`);
  return rows.map(fromRow);
}

export async function listTradesByIsin(db: DbClient, isin: string): Promise<TradeRow[]> {
  const rows = await db.select<TradeDbRow[]>(
    `${SELECT_SQL} WHERE tr.security_isin = $1 ORDER BY t.occurred_at`,
    [isin],
  );
  return rows.map(fromRow);
}

/** A ticker Halyk's own statement names that the dictionary doesn't
 * recognize yet gets a placeholder row (synthetic isin) instead of
 * failing the import — same "degrade gracefully, let the user fix the
 * reference data later" principle as debts.ts's findOrCreatePersonByAlias. */
export async function findOrCreateSecurityByTicker(db: DbClient, ticker: string): Promise<string> {
  const existing = await db.select<{ isin: string }[]>("SELECT isin FROM securities WHERE ticker = $1", [ticker]);
  if (existing[0]) return existing[0].isin;

  const isin = `UNKNOWN:${ticker}`;
  await db.execute(
    `INSERT INTO securities (isin, ticker, name, industry) VALUES ($1, $2, $3, NULL)
     ON CONFLICT (isin) DO NOTHING`,
    [isin, ticker, ticker],
  );
  return isin;
}

export type InsertTradeInput = {
  transactionId: number;
  isin: string;
  side: TradeSide;
  amountTiyin: number;
  orderNumber: string | null;
  commissionTiyin: number;
};

export async function insertTrade(db: DbClient, input: InsertTradeInput): Promise<number> {
  const result = await db.execute(
    `INSERT INTO trades (transaction_id, security_isin, side, amount_tiyin, order_number, commission_tiyin)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.transactionId, input.isin, input.side, input.amountTiyin, input.orderNumber, input.commissionTiyin],
  );
  return result.lastInsertId!;
}

export async function setEstimatedQuantity(db: DbClient, tradeId: number, quantity: number): Promise<void> {
  await db.execute("UPDATE trades SET estimated_quantity = $1 WHERE id = $2", [quantity, tradeId]);
}

export async function tradeExistsForTransaction(db: DbClient, transactionId: number): Promise<boolean> {
  const rows = await db.select<{ id: number }[]>("SELECT id FROM trades WHERE transaction_id = $1", [transactionId]);
  return rows.length > 0;
}
