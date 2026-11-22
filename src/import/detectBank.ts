import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { ensurePdfWorker } from "../parsers/pdfjsWorker";

export type BankKind = "kaspi" | "halyk" | "eurasian" | "bcc";

// Each bank's own BIC is printed on every statement page and is far more
// reliable than matching on wording (see the Eurasian ligature problem).
const MARKERS: [BankKind, RegExp][] = [
  ["kaspi", /CASPKZKA/],
  ["halyk", /HSBKKZKX/],
  ["eurasian", /EURIKZKA/],
  ["bcc", /KCJBKZKX/],
];

export async function detectBank(data: Uint8Array): Promise<BankKind | null> {
  await ensurePdfWorker();
  const doc = await getDocument({ data, useWorkerFetch: false }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map((i) => ("str" in i ? (i.str as string) : "")).join(" ");

  for (const [bank, marker] of MARKERS) {
    if (marker.test(text)) return bank;
  }
  return null;
}
