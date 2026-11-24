-- SPEC-2.md 9: a trade/dividend row always points back at the real bank
-- transaction it came from (transaction_id), same provenance principle as
-- debts in 0008. `securities` is the editable ISIN<->ticker<->name<->
-- industry dictionary (9.1) — an unrecognized ISIN just has no row here
-- yet, the user can add one by hand.
CREATE TABLE securities (
    isin TEXT PRIMARY KEY,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    industry TEXT
);

-- ISINs verified against kase.kz/en/investors/shares/<ticker> directly
-- (not guessed) — a wrong ISIN here would silently break every dividend/
-- snapshot join for that ticker.
INSERT INTO securities (isin, ticker, name, industry) VALUES
    ('KZ000A0LE0S4', 'HSBK', 'Halyk Bank', 'Финансы'),
    ('KZ1C00001536', 'KSPI', 'Kaspi.kz', 'Финансы'),
    ('KZ1C00000744', 'KZTO', 'KazTransOil', 'Нефть и газ'),
    ('KZ0009093241', 'KZTK', 'Kazakhtelecom', 'Телеком'),
    ('KZ1C00001122', 'KMGZ', 'KazMunayGas', 'Нефть и газ'),
    ('KZ1C00000959', 'KEGC', 'KEGOC', 'Энергетика'),
    ('KZ1C00000876', 'KCEL', 'Kcell', 'Телеком');

-- A trade's own cash amount/date/description already live on `transactions`
-- (transaction_id) — this table only adds what the bank statement doesn't
-- give: which security, which side, what KASE order it was, and (once
-- prices are downloaded) the quantity estimated from amount / price that
-- day. `estimated_quantity` starts NULL and is filled in once a price
-- exists for that date (SPEC-2.md 9.1/9.2 are a hard dependency: no price,
-- no quantity).
CREATE TABLE trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    security_isin TEXT NOT NULL REFERENCES securities(isin),
    side TEXT NOT NULL,              -- 'buy' | 'sell'
    amount_tiyin INTEGER NOT NULL,   -- positive, the trade's own cash value
    order_number TEXT,
    commission_tiyin INTEGER NOT NULL DEFAULT 0,
    estimated_quantity INTEGER
);

-- `security_isin` is stored as-is from the statement, not constrained to
-- `securities` — an ISIN the dictionary doesn't recognize yet still gets a
-- row here, just without a resolvable ticker/name until the user adds one.
CREATE TABLE dividends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id),
    security_isin TEXT NOT NULL,
    per_share_tiyin INTEGER NOT NULL,
    tax_rate_percent REAL NOT NULL DEFAULT 0,
    quantity_at_payment INTEGER NOT NULL  -- exact: amount / per_share_tiyin
);

-- From the HTML "Выписка с лицевого счета" snapshots (9.1) — the golden
-- reference quantity, independent of any price estimation.
CREATE TABLE security_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    security_isin TEXT NOT NULL,
    snapshot_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    UNIQUE(security_isin, snapshot_date)
);

-- KASE daily close price cache (9.2) — downloaded once, read offline after
-- that; "Обновить цены" only re-fetches days missing from this table.
CREATE TABLE security_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    security_isin TEXT NOT NULL,
    date TEXT NOT NULL,
    close_tiyin INTEGER NOT NULL,
    UNIQUE(security_isin, date)
);
