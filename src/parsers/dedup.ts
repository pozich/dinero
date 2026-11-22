export type DedupInput = {
  accountKind: string;
  occurredAt: string;
  amountTiyin: number;
  description: string;
};

/**
 * (счёт, дата, сумма, описание, порядковый номер повтора в дне) — см. SPEC.md 6.2.
 * Two identical-looking operations on the same day (two coffees at 900 ₸) get
 * different keys because of the trailing ordinal; re-running this on the same
 * input in the same order reproduces the same keys.
 */
export function assignDedupKeys<T extends DedupInput>(
  transactions: T[],
): (T & { dedupKey: string })[] {
  const seen = new Map<string, number>();
  return transactions.map((t) => {
    const day = t.occurredAt.slice(0, 10);
    const base = `${t.accountKind}|${day}|${t.amountTiyin}|${t.description}`;
    const ordinal = (seen.get(base) ?? 0) + 1;
    seen.set(base, ordinal);
    return { ...t, dedupKey: `${base}|${ordinal}` };
  });
}

/** Hash of the whole Statement file — a repeat import of the same file is skipped entirely. */
export async function hashFile(data: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
