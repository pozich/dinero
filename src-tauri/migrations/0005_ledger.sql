-- SPEC-2.md Ф5 / раздел 1: the ledger module needs two things the schema
-- didn't carry yet.
--
-- is_investment_income: dividends count as income (unlike other
-- "Инвестиции"-category operations, which the ledger excludes entirely),
-- but with a flag so analytics can show/hide them separately — persisted
-- at import time rather than derived from raw_type text, so a future wording
-- change in a bank's statement can't silently break it.
ALTER TABLE transactions ADD COLUMN is_investment_income INTEGER NOT NULL DEFAULT 0;

-- closing_balance_tiyin: every parser already computes this for its own
-- golden check, it just wasn't kept around — needed now to flag a balance
-- discrepancy against the real account (SPEC-2.md 6.1). NULL for
-- statements imported before this column existed.
ALTER TABLE statements ADD COLUMN closing_balance_tiyin INTEGER;
