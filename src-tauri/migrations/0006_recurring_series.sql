-- SPEC-2.md 6.6: a detected series isn't stored (it's recomputed fresh
-- from the ledger every time), but the user's own "да, это точно
-- подписка" / "скрыть, это не серия" decision about one has to survive a
-- restart — hence this one small table, keyed by the same series key
-- findRecurringSeries computes (account + normalized description + sign).
CREATE TABLE recurring_series_state (
    series_key TEXT PRIMARY KEY,
    hidden INTEGER NOT NULL DEFAULT 0,
    confirmed INTEGER NOT NULL DEFAULT 0
);
