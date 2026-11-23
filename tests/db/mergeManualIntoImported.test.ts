import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { findOrCreateCategory } from "../../src/db/categories";
import { insertTransaction, setTransactionCategory } from "../../src/db/transactions";
import { insertManualTransaction, mergeManualIntoImported } from "../../src/db/manualTransactions";

describe("mergeManualIntoImported", () => {
  it("moves the manual entry's note and category onto the imported row, then removes the manual one", async () => {
    const db = createTestDb();
    const cashId = await getAccountIdByKind(db, "cash");

    const manualId = await insertManualTransaction(db, {
      accountId: cashId,
      occurredAt: "2026-01-05T00:00:00.000Z",
      amountTiyin: -150000,
      description: "Такси (руками)",
      note: "вечером домой",
    });
    const taxiCategory = await findOrCreateCategory(db, "Транспорт");
    await setTransactionCategory(db, manualId, taxiCategory, -150000);

    const importedId = await insertTransaction(db, {
      accountId: cashId,
      statementId: null,
      occurredAt: "2026-01-05T00:00:00.000Z",
      amountTiyin: -150000,
      description: "ATM withdrawal",
      rawType: "Снятие денег без карты",
      dedupKey: "k1",
    });

    await mergeManualIntoImported(db, manualId, importedId);

    const [importedRow] = await db.select<{ note: string }[]>(
      "SELECT note FROM transactions WHERE id = $1",
      [importedId],
    );
    expect(importedRow.note).toBe("вечером домой");

    const importedSplits = await db.select<{ category_id: number }[]>(
      "SELECT category_id FROM splits WHERE transaction_id = $1",
      [importedId],
    );
    expect(importedSplits).toEqual([{ category_id: taxiCategory }]);

    const [{ n: manualStillExists }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM transactions WHERE id = $1",
      [manualId],
    );
    expect(manualStillExists).toBe(0);
  });
});
