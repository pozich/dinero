-- SPEC-2.md 10: savings goals. A goal's progress is computed, never
-- stored — only "конверт"-type goals need their own ledger of
-- contributions (an account/portfolio goal's progress comes straight from
-- the account balance / portfolio value, see src/goals/progress.ts).
CREATE TABLE goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount_tiyin INTEGER NOT NULL,
    deadline TEXT,
    icon TEXT,
    priority INTEGER NOT NULL,
    note TEXT,
    location_type TEXT NOT NULL,              -- 'account' | 'envelope' | 'portfolio'
    location_account_id INTEGER REFERENCES accounts(id),
    deposit_rate_percent REAL,
    status TEXT NOT NULL DEFAULT 'active'      -- 'active' | 'achieved'
);

-- Only meaningful for location_type='envelope' — a positive amount is a
-- deposit into the envelope, negative is "забрать обратно".
CREATE TABLE goal_contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id),
    amount_tiyin INTEGER NOT NULL,
    occurred_at TEXT NOT NULL
);

-- "по правилу (например, каждый перевод на Kaspi Deposit -> в эту цель)" —
-- applied automatically and deterministically, same spirit as
-- category_rules, not a review-and-confirm flow.
CREATE TABLE goal_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    account_kind TEXT,
    sign TEXT,                 -- 'income' | 'expense'
    min_amount_tiyin INTEGER,
    max_amount_tiyin INTEGER
);

-- "покупку можно связать с целью (метка в аналитике)" — a tag, not an
-- exclusion: a linked transaction still counts as a normal expense in the
-- ledger, this just lets the goal screen show what's been earmarked.
CREATE TABLE goal_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    UNIQUE(transaction_id)
);
