import { describe, expect, it } from "vitest";
import { assignDedupKeys, hashFile } from "../../src/parsers/dedup";

describe("dedup key", () => {
  it("two identical operations the same day get different keys (two coffees, not a dupe)", () => {
    const coffee = {
      accountKind: "kaspi_gold",
      occurredAt: "2026-10-20T00:00:00.000Z",
      amountTiyin: -90000,
      description: "Сатти Маркет",
    };
    const [a, b] = assignDedupKeys([coffee, coffee]);
    expect(a.dedupKey).not.toBe(b.dedupKey);
  });

  it("re-running on the same rows in the same order reproduces the same keys", () => {
    const txs = [
      {
        accountKind: "kaspi_gold",
        occurredAt: "2026-10-20T00:00:00.000Z",
        amountTiyin: -90000,
        description: "Сатти Маркет",
      },
      {
        accountKind: "kaspi_gold",
        occurredAt: "2026-10-20T00:00:00.000Z",
        amountTiyin: -90000,
        description: "Сатти Маркет",
      },
    ];
    const first = assignDedupKeys(txs).map((t) => t.dedupKey);
    const second = assignDedupKeys(txs).map((t) => t.dedupKey);
    expect(second).toEqual(first);
  });

  it("different accounts/dates/amounts/descriptions never collide", () => {
    const keys = assignDedupKeys([
      {
        accountKind: "kaspi_gold",
        occurredAt: "2026-10-20T00:00:00.000Z",
        amountTiyin: -90000,
        description: "A",
      },
      {
        accountKind: "halyk_salary",
        occurredAt: "2026-10-20T00:00:00.000Z",
        amountTiyin: -90000,
        description: "A",
      },
    ]).map((t) => t.dedupKey);
    expect(new Set(keys).size).toBe(2);
  });

  it("file hash is stable for identical bytes and differs for different bytes", async () => {
    const a = await hashFile(new TextEncoder().encode("hello"));
    const b = await hashFile(new TextEncoder().encode("hello"));
    const c = await hashFile(new TextEncoder().encode("hello!"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
