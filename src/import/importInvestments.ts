import type { DbClient } from "../db/types";
import type { ParsedTransaction } from "../parsers/types";
import { parseTradeDescription, parseDividendDescription } from "../investments/parseInvestDescription";
import { findOrCreateSecurityByTicker, insertTrade, tradeExistsForTransaction } from "../db/trades";
import { insertDividend, dividendExistsForTransaction } from "../db/dividends";

async function getCommissionForTransaction(db: DbClient, transactionId: number): Promise<number> {
  const rows = await db.select<{ amount_tiyin: number }[]>(
    "SELECT amount_tiyin FROM transactions WHERE related_transaction_id = $1",
    [transactionId],
  );
  return rows.reduce((sum, r) => sum + Math.abs(r.amount_tiyin), 0);
}

/**
 * SPEC-2.md 9.1 — only called for the Halyk "Стандарт" account. Pulls
 * structured trade/dividend rows out of transactions importStatement.ts
 * already inserted. Guarded per-transaction, not just per-file: on a
 * re-import, insertAll reuses an existing transaction's id instead of
 * inserting a new row, so this must not double-insert a trade/dividend
 * behind a transaction it's already processed. Must run after fee linking
 * (related_transaction_id) so a trade's commission can be looked up.
 */
export async function importInvestmentRows(
  db: DbClient,
  transactions: readonly ParsedTransaction[],
  transactionIds: readonly number[],
): Promise<void> {
  for (let i = 0; i < transactions.length; i++) {
    const transactionId = transactionIds[i];
    const description = transactions[i].description;

    const trade = parseTradeDescription(description);
    if (trade) {
      if (await tradeExistsForTransaction(db, transactionId)) continue;
      const isin = await findOrCreateSecurityByTicker(db, trade.ticker);
      const commissionTiyin = await getCommissionForTransaction(db, transactionId);
      await insertTrade(db, {
        transactionId,
        isin,
        side: trade.side,
        amountTiyin: Math.abs(transactions[i].amountTiyin),
        orderNumber: trade.orderNumber,
        commissionTiyin,
      });
      continue;
    }

    const dividend = parseDividendDescription(description);
    if (dividend) {
      if (await dividendExistsForTransaction(db, transactionId)) continue;
      const quantityAtPayment =
        dividend.perShareTiyin > 0 ? Math.round(transactions[i].amountTiyin / dividend.perShareTiyin) : 0;
      await insertDividend(db, {
        transactionId,
        isin: dividend.isin,
        perShareTiyin: dividend.perShareTiyin,
        taxRatePercent: dividend.taxRatePercent,
        quantityAtPayment,
      });
    }
  }
}
