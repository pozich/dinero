-- SPEC-2.md 8: people, their debts, and repayments. A debt's
-- transaction_id (and a repayment's) is NULL for a manual cash entry,
-- otherwise points at the real bank transaction it was marked from.
CREATE TABLE people (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
);

CREATE TABLE person_aliases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    alias TEXT NOT NULL UNIQUE
);

CREATE TABLE debts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    person_id INTEGER NOT NULL REFERENCES people(id),
    direction TEXT NOT NULL,        -- 'lent' (мне должны) | 'borrowed' (я должен)
    transaction_id INTEGER REFERENCES transactions(id),
    amount_tiyin INTEGER NOT NULL,  -- always positive: the principal
    occurred_at TEXT NOT NULL,
    due_date TEXT,
    note TEXT,
    status TEXT NOT NULL DEFAULT 'open'  -- open | closed | forgiven
);

CREATE TABLE debt_repayments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debt_id INTEGER NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id),
    amount_tiyin INTEGER NOT NULL,
    occurred_at TEXT NOT NULL
);
