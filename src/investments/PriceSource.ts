export type DailyPrice = { date: string; closeTiyin: number };

export type PriceSourceError = { kind: "network" | "format" | "no_data"; message: string };

export type PriceSourceResult = { ok: true; prices: DailyPrice[] } | { ok: false; error: PriceSourceError };

/**
 * SPEC-2.md 9.2: "отдельный модуль-адаптер... если источник поменяется —
 * меняется один файл". Every other part of the app (cache, "Обновить
 * цены" button, position math) depends on this interface, never on KASE
 * directly, so swapping the source later means replacing one
 * implementation of this file, not touching the rest of Ф8.
 */
export interface PriceSource {
  fetchHistory(ticker: string, from: Date, to: Date): Promise<PriceSourceResult>;
}
