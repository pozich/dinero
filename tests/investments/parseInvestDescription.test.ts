import { describe, expect, it } from "vitest";
import { parseTradeDescription, parseDividendDescription } from "../../src/investments/parseInvestDescription";

describe("parseTradeDescription", () => {
  it("parses a buy with a whole-number sum", () => {
    expect(parseTradeDescription("Покупка акции: KEGC . На сумму: 21780. Номер заявки: BP0003342626")).toEqual({
      side: "buy",
      ticker: "KEGC",
      orderTotalTiyin: 2178000,
      orderNumber: "BP0003342626",
    });
  });

  it("parses a buy with a decimal sum", () => {
    expect(parseTradeDescription("Покупка акции: KZTO . На сумму: 14651.82. Номер заявки: BP0003342647")).toEqual({
      side: "buy",
      ticker: "KZTO",
      orderTotalTiyin: 1465182,
      orderNumber: "BP0003342647",
    });
  });

  it("parses a sell", () => {
    expect(parseTradeDescription("Продажа акции: KZTO . На сумму: 20106. Номер заявки: SP0001328163")).toEqual({
      side: "sell",
      ticker: "KZTO",
      orderTotalTiyin: 2010600,
      orderNumber: "SP0001328163",
    });
  });

  it("parses a sum with a float-artifact tail (real sample has this)", () => {
    const parsed = parseTradeDescription(
      "Продажа акции: HSBK . На сумму: 59986.549999999996. Номер заявки: SP0001349122",
    );
    expect(parsed?.orderTotalTiyin).toBe(5998655);
  });

  it("returns null for an unrelated description", () => {
    expect(parseTradeDescription("Поступление перевода")).toBeNull();
    expect(parseTradeDescription("Перевод на другую карту")).toBeNull();
  });
});

describe("parseDividendDescription", () => {
  it("parses a whole-number per-share dividend", () => {
    expect(
      parseDividendDescription(
        "Выплата дивидендов по ЦБ KZ000A0LE0S4 дивиденд на 1 акцию 21 KZT по месту хранения ЦДЦБ ставка налога 0",
      ),
    ).toEqual({ isin: "KZ000A0LE0S4", perShareTiyin: 2100, taxRatePercent: 0 });
  });

  it("parses a decimal per-share dividend", () => {
    expect(
      parseDividendDescription(
        "Выплата дивидендов по ЦБ KZ1C00000959 дивиденд на 1 акцию 80.9 KZT по месту хранения ЦДЦБ ставка налога 0",
      ),
    ).toEqual({ isin: "KZ1C00000959", perShareTiyin: 8090, taxRatePercent: 0 });
  });

  it("returns null for an unrelated description", () => {
    expect(parseDividendDescription("Поступление перевода")).toBeNull();
  });
});
