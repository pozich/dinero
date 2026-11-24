import type { DbClient } from "./types";

export type Security = { isin: string; ticker: string; name: string; industry: string | null };

/** SPEC-2.md 9.1's editable dictionary — seeded with 7 known tickers
 * (migration 0009), but a trade/dividend row can carry an ISIN this table
 * doesn't recognize yet (an unresolved ISIN just has no row here). */
export function listSecurities(db: DbClient): Promise<Security[]> {
  return db.select<Security[]>("SELECT * FROM securities ORDER BY ticker");
}

export async function getSecurity(db: DbClient, isin: string): Promise<Security | null> {
  const rows = await db.select<Security[]>("SELECT * FROM securities WHERE isin = $1", [isin]);
  return rows[0] ?? null;
}

export async function upsertSecurity(db: DbClient, security: Security): Promise<void> {
  await db.execute(
    `INSERT INTO securities (isin, ticker, name, industry) VALUES ($1, $2, $3, $4)
     ON CONFLICT (isin) DO UPDATE SET ticker = excluded.ticker, name = excluded.name, industry = excluded.industry`,
    [security.isin, security.ticker, security.name, security.industry],
  );
}

export async function deleteSecurity(db: DbClient, isin: string): Promise<void> {
  await db.execute("DELETE FROM securities WHERE isin = $1", [isin]);
}
