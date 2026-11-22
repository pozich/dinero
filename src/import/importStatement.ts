import type { DbClient } from "../db/types";
import type { ParsedTransaction } from "../parsers/types";
import { detectBank } from "./detectBank";
import { parseKaspi } from "../parsers/kaspi";
import { parseHalyk } from "../parsers/halyk";
import { parseEurasian } from "../parsers/eurasian";
import { parseBcc } from "../parsers/bcc";
import { checkGolden, type GoldenResult } from "../parsers/goldenCheck";
import { expandKaspiDepositMirrors } from "../parsers/kaspiDeposit";
import { expandCashMirrors } from "../parsers/cashMirror";
import { assignDedupKeys, hashFile } from "../parsers/dedup";
import { getAccountIdByKind } from "../db/accounts";
import { findStatementByHash, insertStatement } from "../db/statements";
import {
  findTransactionByDedupKey,
  insertTransaction,
  insertTransferLink,
} from "../db/transactions";

export type ImportResult =
  | { status: "duplicate_file" }
  | { status: "golden_mismatch"; golden: GoldenResult }
  | { status: "imported"; accountKind: string; inserted: number; skippedDuplicateRows: number };

/** Inserts every transaction for one account, skipping rows whose dedup key
 * already exists (SPEC.md 6.2). Returns the DB id for every input row, in
 * the same order, so callers can link mirrors/fees back to their parent. */
async function insertAll(
  db: DbClient,
  accountKind: string,
  statementId: number | null,
  transactions: ParsedTransaction[],
): Promise<{ ids: number[]; inserted: number; skipped: number }> {
  const accountId = await getAccountIdByKind(db, accountKind);
  const keyed = assignDedupKeys(
    transactions.map((t) => ({
      accountKind,
      occurredAt: t.occurredAt,
      amountTiyin: t.amountTiyin,
      description: t.description,
    })),
  );

  const ids: number[] = [];
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < transactions.length; i++) {
    const existingId = await findTransactionByDedupKey(db, keyed[i].dedupKey);
    if (existingId) {
      ids.push(existingId);
      skipped++;
      continue;
    }
    const t = transactions[i];
    const id = await insertTransaction(db, {
      accountId,
      statementId,
      occurredAt: t.occurredAt,
      amountTiyin: t.amountTiyin,
      description: t.description,
      rawType: t.rawType,
      dedupKey: keyed[i].dedupKey,
    });
    ids.push(id);
    inserted++;
  }

  return { ids, inserted, skipped };
}

async function linkCashMirrors(
  db: DbClient,
  statementId: number | null,
  parentIds: number[],
  parentTransactions: ParsedTransaction[],
): Promise<{ inserted: number; skipped: number }> {
  const { mirrors, links } = expandCashMirrors(parentTransactions);
  if (mirrors.length === 0) return { inserted: 0, skipped: 0 };

  const { ids: mirrorIds, inserted, skipped } = await insertAll(db, "cash", statementId, mirrors);
  for (const link of links) {
    await insertTransferLink(db, parentIds[link.parentIndex], mirrorIds[link.cashIndex], true);
  }
  return { inserted, skipped };
}

export async function importStatement(
  db: DbClient,
  data: Uint8Array,
  fileName: string,
): Promise<ImportResult> {
  const fileHash = await hashFile(data);
  if (await findStatementByHash(db, fileHash)) {
    return { status: "duplicate_file" };
  }

  // pdfjs's Node "fake worker" takes ownership of the buffer it's handed
  // (like a structured-clone transfer), so every call gets its own copy.
  const bank = await detectBank(data.slice());
  if (!bank) throw new Error("Не удалось определить банк по содержимому файла");

  if (bank === "kaspi") {
    const statement = await parseKaspi(data.slice());
    const golden = checkGolden(statement);
    if (!golden.ok) return { status: "golden_mismatch", golden };

    const accountId = await getAccountIdByKind(db, "kaspi_gold");
    const statementId = await insertStatement(db, {
      accountId,
      bank: "kaspi",
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      fileHash,
      fileName,
    });

    const main = await insertAll(db, "kaspi_gold", statementId, statement.transactions);

    const { mirrors: depositMirrors, links: depositLinks } = expandKaspiDepositMirrors(
      statement.transactions,
    );
    const deposit = await insertAll(db, "kaspi_deposit", statementId, depositMirrors);
    for (const link of depositLinks) {
      await insertTransferLink(
        db,
        main.ids[link.kaspiGoldIndex],
        deposit.ids[link.kaspiDepositIndex],
        true,
      );
    }

    const cash = await linkCashMirrors(db, statementId, main.ids, statement.transactions);

    return {
      status: "imported",
      accountKind: "kaspi_gold",
      inserted: main.inserted + deposit.inserted + cash.inserted,
      skippedDuplicateRows: main.skipped + deposit.skipped + cash.skipped,
    };
  }

  if (bank === "halyk") {
    const statement = await parseHalyk(data.slice());
    const golden = checkGolden({
      summary: statement.summary,
      transactions: [...statement.transactions, ...statement.fees],
    });
    if (!golden.ok) return { status: "golden_mismatch", golden };

    const accountId = await getAccountIdByKind(db, statement.accountKind);
    const statementId = await insertStatement(db, {
      accountId,
      bank: "halyk",
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      fileHash,
      fileName,
    });

    const main = await insertAll(db, statement.accountKind, statementId, statement.transactions);

    // all fees are inserted together so dedup ordinals are computed across
    // the whole set, not reset to 1 for every single fee
    const fees = await insertAll(db, statement.accountKind, statementId, statement.fees);
    for (const link of statement.feeLinks) {
      // a fee is a second transaction on the SAME account, linked to its
      // parent directly (not a transfer_link — see SPEC.md 5/4.3)
      await db.execute("UPDATE transactions SET related_transaction_id = $1 WHERE id = $2", [
        main.ids[link.parentIndex],
        fees.ids[link.feeIndex],
      ]);
    }

    const cash = await linkCashMirrors(db, statementId, main.ids, statement.transactions);

    return {
      status: "imported",
      accountKind: statement.accountKind,
      inserted: main.inserted + fees.inserted + cash.inserted,
      skippedDuplicateRows: main.skipped + fees.skipped + cash.skipped,
    };
  }

  if (bank === "eurasian") {
    const statement = await parseEurasian(data.slice());
    const golden = checkGolden(statement);
    if (!golden.ok) return { status: "golden_mismatch", golden };

    const accountId = await getAccountIdByKind(db, "eurasian");
    const statementId = await insertStatement(db, {
      accountId,
      bank: "eurasian",
      periodStart: statement.periodStart,
      periodEnd: statement.periodEnd,
      fileHash,
      fileName,
    });
    const main = await insertAll(db, "eurasian", statementId, statement.transactions);
    return {
      status: "imported",
      accountKind: "eurasian",
      inserted: main.inserted,
      skippedDuplicateRows: main.skipped,
    };
  }

  const statement = await parseBcc(data.slice());
  const golden = checkGolden(statement);
  if (!golden.ok) return { status: "golden_mismatch", golden };

  const accountId = await getAccountIdByKind(db, "bcc");
  const statementId = await insertStatement(db, {
    accountId,
    bank: "bcc",
    periodStart: statement.periodStart,
    periodEnd: statement.periodEnd,
    fileHash,
    fileName,
  });
  const main = await insertAll(db, "bcc", statementId, statement.transactions);
  return {
    status: "imported",
    accountKind: "bcc",
    inserted: main.inserted,
    skippedDuplicateRows: main.skipped,
  };
}
