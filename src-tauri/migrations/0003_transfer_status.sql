-- SPEC-2.md 3.1/3.2: a confirmed/rejected pair needs a third state so a
-- rejected candidate is remembered and never resuggested — plain 0/1
-- couldn't tell "rejected" apart from "not decided yet". `kind` tells a
-- same-account purchase<->refund pair apart from a cross-account transfer,
-- since the ledger module nets them differently (SPEC-2.md 1).
ALTER TABLE transfer_links ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE transfer_links ADD COLUMN kind TEXT NOT NULL DEFAULT 'transfer';

UPDATE transfer_links SET status = CASE WHEN confirmed = 1 THEN 'confirmed' ELSE 'pending' END;

ALTER TABLE transfer_links DROP COLUMN confirmed;
