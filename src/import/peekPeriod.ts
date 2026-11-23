import { detectBank } from "./detectBank";
import { parseKaspi } from "../parsers/kaspi";
import { parseHalyk } from "../parsers/halyk";
import { parseEurasian } from "../parsers/eurasian";
import { parseBcc } from "../parsers/bcc";

/**
 * A lightweight pre-parse just for the statement's period — used to sort a
 * batch of files before importing them in period order (SPEC-2.md 3.3).
 * This re-parses the file (importStatement will do it again properly);
 * that's wasted work, but only ever on a handful of files picked at once,
 * and it avoids reshaping importStatement's own pipeline just for ordering.
 */
export async function peekPeriodStart(data: Uint8Array): Promise<string | null> {
  const bank = await detectBank(data.slice());
  if (!bank) return null;
  if (bank === "kaspi") return (await parseKaspi(data.slice())).periodStart;
  if (bank === "halyk") return (await parseHalyk(data.slice())).periodStart;
  if (bank === "eurasian") return (await parseEurasian(data.slice())).periodStart;
  return (await parseBcc(data.slice())).periodStart;
}
