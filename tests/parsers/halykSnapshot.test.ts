import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHalykSnapshot } from "../../src/parsers/halykSnapshot";

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAPSHOTS_DIR = path.resolve(here, "../../samples/Halyk/snapshots");
const hasSamples = fs.existsSync(SNAPSHOTS_DIR);

describe.skipIf(!hasSamples)("parseHalykSnapshot (real samples)", () => {
  it("reads the snapshot date and every known holding's quantity from the November 2025 file", () => {
    const html = fs.readFileSync(path.join(SNAPSHOTS_DIR, "halyk_2025-11.html"), "utf-8");
    const snapshot = parseHalykSnapshot(html);

    expect(snapshot.snapshotDate).toBe("2025-11-30T00:00:00.000Z");

    const byIsin = new Map(snapshot.holdings.map((h) => [h.isin, h.quantity]));
    // Cross-checked by hand against the raw HTML's <tr>/<td> structure.
    expect(byIsin.get("KZ000A0LE0S4")).toBe(155); // HSBK
    expect(byIsin.get("KZ1C00001536")).toBe(3); // KSPI
    expect(byIsin.get("KZ1C00000876")).toBe(9); // KCEL
    expect(byIsin.get("KZ1C00000744")).toBe(18); // KZTO
    expect(byIsin.get("KZ1C00000959")).toBe(20); // KEGC
  });

  it("parses every one of the 12 real snapshots without throwing, each with a sane date and holdings", () => {
    const files = fs.readdirSync(SNAPSHOTS_DIR).filter((f) => f.endsWith(".html"));
    expect(files.length).toBe(12);
    for (const file of files) {
      const html = fs.readFileSync(path.join(SNAPSHOTS_DIR, file), "utf-8");
      const snapshot = parseHalykSnapshot(html);
      expect(snapshot.snapshotDate).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
      expect(snapshot.holdings.length).toBeGreaterThan(0);
      for (const h of snapshot.holdings) {
        expect(h.isin).toMatch(/^[A-Z]{2}[0-9A-Z]{10}$/);
        expect(h.quantity).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never captures the account holder's ФИО/ИИН as a holding", () => {
    const html = fs.readFileSync(path.join(SNAPSHOTS_DIR, "halyk_2025-11.html"), "utf-8");
    const snapshot = parseHalykSnapshot(html);
    for (const h of snapshot.holdings) {
      expect(h.isin).not.toMatch(/\d{12}/); // an ИИН is 12 digits, no letters
    }
  });
});

describe("parseHalykSnapshot", () => {
  it("throws a clear error when the snapshot date can't be found", () => {
    expect(() => parseHalykSnapshot("<html><body>nothing here</body></html>")).toThrow();
  });

  it("ignores a row shorter than the holdings table needs", () => {
    const html = `
      по состоянию на 30.11.2025 23:59:59
      <tr><td>1</td><td>too</td><td>short</td></tr>
    `;
    expect(parseHalykSnapshot(html).holdings).toHaveLength(0);
  });
});
