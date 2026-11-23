import { describe, expect, it } from "vitest";
import { createTestDb } from "../testDb";
import { getAccountIdByKind } from "../../src/db/accounts";
import { insertTransaction, setTransactionCategory } from "../../src/db/transactions";
import { findOrCreateCategory } from "../../src/db/categories";
import {
  insertManualTransaction,
  updateManualTransaction,
  deleteManualTransaction,
} from "../../src/db/manualTransactions";

describe("manualTransactions", () => {
  it("insertManualTransaction marks the row as manual with a synthetic dedup key", async () => {
    const db = createTestDb();
    const cashId = await getAccountIdByKind(db, "cash");
    const id = await insertManualTransaction(db, {
      accountId: cashId,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -150000,
      description: "Такси",
    });

    const [row] = await db.select<{ is_manual: number; dedup_key: string }[]>(
      "SELECT is_manual, dedup_key FROM transactions WHERE id = $1",
      [id],
    );
    expect(row.is_manual).toBe(1);
    expect(row.dedup_key).toMatch(/^manual:/);
  });

  it("allows two identical manual entries side by side (same day, same amount)", async () => {
    const db = createTestDb();
    const cashId = await getAccountIdByKind(db, "cash");
    const input = {
      accountId: cashId,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -90000,
      description: "Кофе",
    };
    await insertManualTransaction(db, input);
    await insertManualTransaction(db, input);

    const [{ n }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM transactions WHERE description = $1",
      ["Кофе"],
    );
    expect(n).toBe(2);
  });

  it("updateManualTransaction changes amount/date/description/note on a manual row", async () => {
    const db = createTestDb();
    const cashId = await getAccountIdByKind(db, "cash");
    const id = await insertManualTransaction(db, {
      accountId: cashId,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -50000,
      description: "Draft",
    });

    await updateManualTransaction(db, id, {
      amountTiyin: -70000,
      description: "Такси до дома",
      note: "вечером",
    });

    const [row] = await db.select<{ amount_tiyin: number; description: string; note: string }[]>(
      "SELECT amount_tiyin, description, note FROM transactions WHERE id = $1",
      [id],
    );
    expect(row).toEqual({ amount_tiyin: -70000, description: "Такси до дома", note: "вечером" });
  });

  it("refuses to edit amount/date/description on an imported (non-manual) transaction", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    const id = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -50000,
      description: "Сатти Маркет",
      rawType: "Purchases",
      dedupKey: "k1",
    });

    await expect(updateManualTransaction(db, id, { amountTiyin: -1 })).rejects.toThrow();
  });

  it("deleteManualTransaction removes the row, its splits, and its transfer_links", async () => {
    const db = createTestDb();
    const cashId = await getAccountIdByKind(db, "cash");
    const id = await insertManualTransaction(db, {
      accountId: cashId,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -50000,
      description: "Такси",
    });
    const foodCategory = await findOrCreateCategory(db, "Транспорт");
    await setTransactionCategory(db, id, foodCategory, -50000);

    await deleteManualTransaction(db, id);

    const [{ n: txCount }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM transactions WHERE id = $1",
      [id],
    );
    const [{ n: splitCount }] = await db.select<{ n: number }[]>(
      "SELECT COUNT(*) AS n FROM splits WHERE transaction_id = $1",
      [id],
    );
    expect(txCount).toBe(0);
    expect(splitCount).toBe(0);
  });

  it("refuses to delete an imported (non-manual) transaction", async () => {
    const db = createTestDb();
    const kaspiId = await getAccountIdByKind(db, "kaspi_gold");
    const id = await insertTransaction(db, {
      accountId: kaspiId,
      statementId: null,
      occurredAt: "2026-01-01T00:00:00.000Z",
      amountTiyin: -50000,
      description: "Сатти Маркет",
      rawType: "Purchases",
      dedupKey: "k2",
    });

    await expect(deleteManualTransaction(db, id)).rejects.toThrow();
  });
});
