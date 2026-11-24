import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTestDb } from "../testDb";
import { importStatement } from "../../src/import/importStatement";
import { queryTransactions } from "../../src/db/transactionsQuery";
import { getAccountIdByKind } from "../../src/db/accounts";

const here = path.dirname(fileURLToPath(import.meta.url));
const samplesRoot = path.resolve(here, "../../samples");
const hasSamples = fs.existsSync(samplesRoot);

function readSample(relativePath: string): Uint8Array {
  return new Uint8Array(fs.readFileSync(path.join(samplesRoot, relativePath)));
}

describe.skipIf(!hasSamples)("importStatement (real sample files, in-memory sqlite)", () => {
  it("imports Kaspi Gold: main rows + Kaspi Deposit mirrors + cash mirrors, all linked", async () => {
    const db = createTestDb();
    const data = readSample("Kaspi/kaspi_oct.pdf");

    const result = await importStatement(db, data, "kaspi_oct.pdf");
    expect(result.status).toBe("imported");

    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    const depositId = await getAccountIdByKind(db, "kaspi_deposit");
    const cashId = await getAccountIdByKind(db, "cash");

    expect(await queryTransactions(db, { accountId: kaspiId })).toHaveLength(311);
    expect(await queryTransactions(db, { accountId: depositId })).toHaveLength(2);
    expect(await queryTransactions(db, { accountId: cashId })).toHaveLength(5);

    const links = await db.select<{ id: number }[]>("SELECT id FROM transfer_links");
    expect(links).toHaveLength(2 + 5); // kaspi deposit + ATM cash-in
  });

  it("re-importing the exact same file is a no-op (file hash dedup)", async () => {
    const db = createTestDb();
    const data = readSample("Kaspi/kaspi_oct.pdf");

    await importStatement(db, data, "kaspi_oct.pdf");
    const before = await queryTransactions(db);

    const second = await importStatement(db, data, "kaspi_oct.pdf");
    expect(second.status).toBe("duplicate_file");

    const after = await queryTransactions(db);
    expect(after).toHaveLength(before.length);
  });

  it("imports Halyk «Зарплата»: main rows + ATM cash mirrors", async () => {
    const db = createTestDb();
    const data = readSample("Halyk/halyk_card_oct.pdf");

    const result = await importStatement(db, data, "halyk_card_oct.pdf");
    expect(result).toMatchObject({ status: "imported", accountKind: "halyk_salary" });

    const halykId = await getAccountIdByKind(db, "halyk_salary");
    const cashId = await getAccountIdByKind(db, "cash");
    expect(await queryTransactions(db, { accountId: halykId })).toHaveLength(74);
    expect(await queryTransactions(db, { accountId: cashId })).toHaveLength(6);
  });

  it("imports Halyk «Стандарт»: broker commissions land as separate linked rows on the same account", async () => {
    const db = createTestDb();
    const data = readSample("Halyk/halyk_invest_oct.pdf");

    const result = await importStatement(db, data, "halyk_invest_oct.pdf");
    expect(result).toMatchObject({ status: "imported", accountKind: "halyk_standard" });

    const standardId = await getAccountIdByKind(db, "halyk_standard");
    // 76 trades/transfers + 36 commission rows, all on the same account
    expect(await queryTransactions(db, { accountId: standardId })).toHaveLength(76 + 36);

    const fees = await db.select<{ id: number; related_transaction_id: number }[]>(
      "SELECT id, related_transaction_id FROM transactions WHERE related_transaction_id IS NOT NULL",
    );
    expect(fees).toHaveLength(36);
  });

  it("flags dividend rows as investment income, and stores the closing balance (SPEC-2.md 1/6.1)", async () => {
    const db = createTestDb();
    const data = readSample("Halyk/halyk_invest_oct.pdf");

    await importStatement(db, data, "halyk_invest_oct.pdf");

    const dividends = await db.select<{ amount_tiyin: number }[]>(
      "SELECT amount_tiyin FROM transactions WHERE is_investment_income = 1",
    );
    expect(dividends.length).toBeGreaterThan(0);
    expect(dividends.every((d) => d.amount_tiyin > 0)).toBe(true);

    const [statement] = await db.select<{ closing_balance_tiyin: number | null }[]>(
      "SELECT closing_balance_tiyin FROM statements WHERE file_name = $1",
      ["halyk_invest_oct.pdf"],
    );
    expect(statement.closing_balance_tiyin).not.toBeNull();
  });

  it("imports Eurasian and BCC as plain transaction lists", async () => {
    const db = createTestDb();
    await importStatement(db, readSample("bcc & ebank/eubank_oct.pdf"), "eubank_oct.pdf");
    await importStatement(db, readSample("bcc & ebank/bcc.pdf"), "bcc.pdf");

    const eurasianId = await getAccountIdByKind(db, "eurasian");
    const bccId = await getAccountIdByKind(db, "bcc");
    expect(await queryTransactions(db, { accountId: eurasianId })).toHaveLength(26);
    expect(await queryTransactions(db, { accountId: bccId })).toHaveLength(27);
  });
});
