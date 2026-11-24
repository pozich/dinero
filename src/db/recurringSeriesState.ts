import type { DbClient } from "./types";

export type RecurringSeriesState = {
  hidden: boolean;
  confirmed: boolean;
};

/** SPEC-2.md 6.6: the series itself is recomputed fresh every time from the
 * ledger, this is only the user's "да, подписка" / "скрыть" decision about
 * a given series key (account + normalized description + sign). */
export async function listRecurringSeriesState(
  db: DbClient,
): Promise<Map<string, RecurringSeriesState>> {
  const rows = await db.select<{ series_key: string; hidden: number; confirmed: number }[]>(
    "SELECT series_key, hidden, confirmed FROM recurring_series_state",
  );
  return new Map(rows.map((r) => [r.series_key, { hidden: r.hidden === 1, confirmed: r.confirmed === 1 }]));
}

async function upsert(db: DbClient, seriesKey: string, hidden: boolean, confirmed: boolean): Promise<void> {
  // `excluded.*` (not a repeated $2/$3) — sqlx binds each placeholder index
  // exactly once, so reusing one across VALUES and SET would be wrong here.
  await db.execute(
    `INSERT INTO recurring_series_state (series_key, hidden, confirmed) VALUES ($1, $2, $3)
     ON CONFLICT (series_key) DO UPDATE SET hidden = excluded.hidden, confirmed = excluded.confirmed`,
    [seriesKey, hidden ? 1 : 0, confirmed ? 1 : 0],
  );
}

export async function setSeriesHidden(db: DbClient, seriesKey: string, hidden: boolean): Promise<void> {
  const current = await listRecurringSeriesState(db);
  await upsert(db, seriesKey, hidden, current.get(seriesKey)?.confirmed ?? false);
}

export async function setSeriesConfirmed(db: DbClient, seriesKey: string, confirmed: boolean): Promise<void> {
  const current = await listRecurringSeriesState(db);
  await upsert(db, seriesKey, current.get(seriesKey)?.hidden ?? false, confirmed);
}
