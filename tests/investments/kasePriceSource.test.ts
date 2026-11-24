import { describe, expect, it } from "vitest";
import { buildKaseHistoryUrl, parseKaseHistoryResponse } from "../../src/investments/kasePriceSource";

describe("buildKaseHistoryUrl", () => {
  it("builds the UDF history URL with unix-second timestamps", () => {
    const url = buildKaseHistoryUrl("KSPI", new Date("2026-01-01T00:00:00.000Z"), new Date("2026-01-02T00:00:00.000Z"));
    expect(url).toBe(
      "https://kase.kz/tv-charts/securities/history?symbol=ALL%3AKSPI&resolution=1D&from=1767225600&to=1767312000&chart_language_code=en",
    );
  });
});

describe("parseKaseHistoryResponse", () => {
  it("parses a real-shaped ok response into tiyin-rounded daily prices", () => {
    const result = parseKaseHistoryResponse({
      c: [40150.0, 40320.0],
      t: [1764547200, 1764633600],
      o: [39660.0, 40390.0],
      v: [78375757.0, 45870764.0],
      h: [40350.0, 40398.0],
      l: [39611.02, 40150.0],
      s: "ok",
    });
    expect(result).toEqual({
      ok: true,
      prices: [
        { date: "2025-12-01", closeTiyin: 4015000 },
        { date: "2025-12-02", closeTiyin: 4032000 },
      ],
    });
  });

  it("treats s:'no_data' as an empty, successful result", () => {
    expect(parseKaseHistoryResponse({ s: "no_data" })).toEqual({ ok: true, prices: [] });
  });

  it("surfaces s:'error' with KASE's own error message", () => {
    const result = parseKaseHistoryResponse({ s: "error", errmsg: "invalid symbol" });
    expect(result).toEqual({ ok: false, error: { kind: "format", message: "invalid symbol" } });
  });

  it("never throws on a garbage response, returns a format error instead", () => {
    expect(parseKaseHistoryResponse(null)).toMatchObject({ ok: false, error: { kind: "format" } });
    expect(parseKaseHistoryResponse("not json")).toMatchObject({ ok: false, error: { kind: "format" } });
    expect(parseKaseHistoryResponse({ s: "ok", t: [1], c: [] })).toMatchObject({ ok: false, error: { kind: "format" } });
  });
});
