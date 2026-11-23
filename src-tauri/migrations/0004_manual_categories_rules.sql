-- SPEC-2.md Ф3: manual transactions, category tree extras, richer rules.
-- is_manual/is_ignored/note live on `transactions` as a whole, not on
-- `splits` — "не учитывать" and the manual/import distinction apply to the
-- whole operation, not to one slice of a split (SPEC-2.md 4.2).
ALTER TABLE transactions ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN is_ignored INTEGER NOT NULL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN note TEXT;

-- Used by future chart work (SPEC-2.md 4.3) — not read anywhere yet.
ALTER TABLE categories ADD COLUMN color TEXT;
ALTER TABLE categories ADD COLUMN icon TEXT;

-- Optional extra rule conditions (SPEC-2.md 4.4), all ANDed with the regex
-- when present. account_kinds is a comma-separated list of accounts.kind
-- values rather than a join table — the set of accounts is small and fixed.
ALTER TABLE category_rules ADD COLUMN account_kinds TEXT;
ALTER TABLE category_rules ADD COLUMN sign TEXT;
ALTER TABLE category_rules ADD COLUMN min_amount_tiyin INTEGER;
ALTER TABLE category_rules ADD COLUMN max_amount_tiyin INTEGER;
