import type { DbClient } from "./types";
import type { DailyPrice, PriceSource } from "../investments/PriceSource";

export async function listPrices(db: DbClient, isin: string): Promise<DailyPrice[]> {
  const rows = await db.select<{ date: string; close_tiyin: number }[]>(
    "SELECT date, close_tiyin FROM security_prices WHERE security_isin = $1 ORDER BY date",
    [isin],
  );
  return rows.map((r) => ({ date: r.date, closeTiyin: r.close_tiyin }));
}

/** The closest trading day's close on or before `date` — a trade can
 * settle on a weekend/holiday with no price of its own, so quantity
 * estimation (src/investments/estimateQuantity.ts) needs "the last known
 * price up to this point", not an exact-date match. */
export async function getPriceOnOrBefore(db: DbClient, isin: string, date: string): Promise<number | null> {
  const rows = await db.select<{ close_tiyin: number }[]>(
    "SELECT close_tiyin FROM security_prices WHERE security_isin = $1 AND date <= $2 ORDER BY date DESC LIMIT 1",
    [isin, date],
  );
  return rows[0]?.close_tiyin ?? null;
}

export async function getLatestPriceDate(db: DbClient, isin: string): Promise<string | null> {
  const rows = await db.select<{ date: string | null }[]>(
    "SELECT MAX(date) AS date FROM security_prices WHERE security_isin = $1",
    [isin],
  );
  return rows[0]?.date ?? null;
}

export async function upsertPrices(db: DbClient, isin: string, prices: readonly DailyPrice[]): Promise<void> {
  for (const p of prices) {
    await db.execute(
      `INSERT INTO security_prices (security_isin, date, close_tiyin) VALUES ($1, $2, $3)
       ON CONFLICT (security_isin, date) DO UPDATE SET close_tiyin = excluded.close_tiyin`,
      [isin, p.date, p.closeTiyin],
    );
  }
}

export type PriceRefreshResult = { isin: string; ticker: string; fetched: number; error: string | null };

/**
 * "Обновить цены" (SPEC-2.md 9.2): only asks the source for days after
 * whatever's already cached (never the whole history again), and a
 * failure for one ticker never stops the others — each gets its own
 * result, the caller decides how to show partial failures.
 */
export async function refreshPrices(
  db: DbClient,
  source: PriceSource,
  securities: readonly { isin: string; ticker: string }[],
  now: Date = new Date(),
): Promise<PriceRefreshResult[]> {
  const results: PriceRefreshResult[] = [];

  for (const { isin, ticker } of securities) {
    const latest = await getLatestPriceDate(db, isin);
    const from = latest ? new Date(new Date(`${latest}T00:00:00.000Z`).getTime() + 86_400_000) : new Date("2000-01-01T00:00:00.000Z");

    if (from > now) {
      results.push({ isin, ticker, fetched: 0, error: null });
      continue;
    }

    const result = await source.fetchHistory(ticker, from, now);
    if (!result.ok) {
      results.push({ isin, ticker, fetched: 0, error: result.error.message });
      continue;
    }
    await upsertPrices(db, isin, result.prices);
    results.push({ isin, ticker, fetched: result.prices.length, error: null });
  }

  return results;
}
