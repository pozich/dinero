// SPEC-2.md 9.1 — calibrated against the real halyk_invest_oct.pdf sample,
// not guessed. A trade description gives ticker/amount/order number, never
// a share count or price (the statement is a cash ledger, not a trade
// confirmation) — see src/investments/estimateQuantity.ts for how quantity
// gets derived instead. A single KASE order can settle across several
// separate transaction rows that all repeat the same "На сумму" total and
// order number but each carry only part of the cash — so that parsed
// total is only useful as a sanity check, never as "this row's own
// amount" (the real transaction.amount_tiyin is the source of truth there).

const TRADE_RE = /(Покупка|Продажа) акции:\s*(\S+)\s*\.\s*На сумму:\s*(\d+(?:\.\d+)?)\.\s*Номер заявки:\s*(\S+)\s*$/u;

export type ParsedTrade = {
  side: "buy" | "sell";
  ticker: string;
  orderTotalTiyin: number;
  orderNumber: string;
};

export function parseTradeDescription(description: string): ParsedTrade | null {
  const match = TRADE_RE.exec(description.trim());
  if (!match) return null;
  const [, sideWord, ticker, sumText, orderNumber] = match;
  return {
    side: sideWord === "Покупка" ? "buy" : "sell",
    ticker,
    orderTotalTiyin: Math.round(Number(sumText) * 100),
    orderNumber,
  };
}

const DIVIDEND_RE = /по ЦБ\s+(\S+)\s+дивиденд на 1 акцию\s+(\d+(?:\.\d+)?)\s*KZT.*?ставка налога\s+(\d+(?:\.\d+)?)/u;

export type ParsedDividend = {
  isin: string;
  perShareTiyin: number;
  taxRatePercent: number;
};

export function parseDividendDescription(description: string): ParsedDividend | null {
  const match = DIVIDEND_RE.exec(description.trim());
  if (!match) return null;
  const [, isin, perShareText, taxText] = match;
  return {
    isin,
    perShareTiyin: Math.round(Number(perShareText) * 100),
    taxRatePercent: Number(taxText),
  };
}
