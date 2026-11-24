import { fetch } from "@tauri-apps/plugin-http";
import type { DailyPrice, PriceSource, PriceSourceResult } from "./PriceSource";

const BASE_URL = "https://kase.kz/tv-charts/securities/history";

/**
 * KASE's own share-page chart calls this exact endpoint (found by
 * inspecting kase.kz/en/investors/shares/KSPI's own network traffic, not
 * guessed) — an undocumented but same-domain JSON "UDF" history feed,
 * daily resolution, confirmed against a live request before writing this.
 */
export function buildKaseHistoryUrl(ticker: string, from: Date, to: Date): string {
  const params = new URLSearchParams({
    symbol: `ALL:${ticker}`,
    resolution: "1D",
    from: String(Math.floor(from.getTime() / 1000)),
    to: String(Math.floor(to.getTime() / 1000)),
    chart_language_code: "en",
  });
  return `${BASE_URL}?${params.toString()}`;
}

type UdfHistoryResponse = {
  s: "ok" | "no_data" | "error";
  t?: number[];
  c?: number[];
  errmsg?: string;
};

function isUdfHistoryResponse(value: unknown): value is UdfHistoryResponse {
  return !!value && typeof value === "object" && typeof (value as { s?: unknown }).s === "string";
}

/** SPEC-2.md 9.2: "ошибка сети/формата — понятное сообщение, приложение
 * не падает" — any shape KASE's response could take ends up as a result,
 * never a thrown exception the caller has to remember to catch. */
export function parseKaseHistoryResponse(json: unknown): PriceSourceResult {
  if (!isUdfHistoryResponse(json)) {
    return { ok: false, error: { kind: "format", message: "Неожиданный формат ответа KASE" } };
  }
  if (json.s === "no_data") {
    return { ok: true, prices: [] };
  }
  if (json.s !== "ok" || !Array.isArray(json.t) || !Array.isArray(json.c) || json.t.length !== json.c.length) {
    return { ok: false, error: { kind: "format", message: json.errmsg ?? "Неожиданный формат ответа KASE" } };
  }

  const prices: DailyPrice[] = json.t.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    closeTiyin: Math.round(json.c![i] * 100),
  }));
  return { ok: true, prices };
}

export const kasePriceSource: PriceSource = {
  async fetchHistory(ticker, from, to) {
    let response: Response;
    try {
      response = await fetch(buildKaseHistoryUrl(ticker, from, to));
    } catch (e) {
      return { ok: false, error: { kind: "network", message: e instanceof Error ? e.message : String(e) } };
    }
    if (!response.ok) {
      return { ok: false, error: { kind: "network", message: `HTTP ${response.status}` } };
    }
    try {
      return parseKaseHistoryResponse(await response.json());
    } catch (e) {
      return { ok: false, error: { kind: "format", message: e instanceof Error ? e.message : String(e) } };
    }
  },
};
