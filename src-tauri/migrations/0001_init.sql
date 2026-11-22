CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    kind TEXT NOT NULL UNIQUE,
    is_transit INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE statements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    bank TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    file_hash TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    imported_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER REFERENCES categories(id),
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id),
    statement_id INTEGER REFERENCES statements(id),
    occurred_at TEXT NOT NULL,
    amount_tiyin INTEGER NOT NULL,
    description TEXT NOT NULL,
    raw_type TEXT,
    dedup_key TEXT NOT NULL UNIQUE,
    related_transaction_id INTEGER REFERENCES transactions(id),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX idx_transactions_account_date ON transactions(account_id, occurred_at);

CREATE TABLE splits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    category_id INTEGER REFERENCES categories(id),
    amount_tiyin INTEGER NOT NULL
);
CREATE INDEX idx_splits_transaction ON splits(transaction_id);

CREATE TABLE transfer_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    to_transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    confirmed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO accounts (name, kind, is_transit) VALUES
    ('Kaspi Gold', 'kaspi_gold', 0),
    ('Halyk «Зарплата»', 'halyk_salary', 0),
    ('Halyk «Стандарт»', 'halyk_standard', 0),
    ('Eurasian', 'eurasian', 1),
    ('BCC', 'bcc', 1),
    ('Наличные', 'cash', 0),
    ('Kaspi Deposit', 'kaspi_deposit', 0);

INSERT INTO categories (name, is_system) VALUES
    ('Инвестиции', 1),
    ('Внутреннее', 1);
