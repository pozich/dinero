import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";

let configured = false;

/** In a real browser/webview pdfjs needs a Worker script URL or it throws
 * ("No GlobalWorkerOptions.workerSrc specified"). Under Node (Vitest) it
 * silently falls back to an in-process fake worker instead, so this is a
 * no-op there — kept lazy/dynamic so the `?url` import is never touched
 * outside a browser. */
export async function ensurePdfWorker(): Promise<void> {
  if (configured || typeof window === "undefined") return;
  const workerUrl = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
  GlobalWorkerOptions.workerSrc = workerUrl;
  configured = true;
}
