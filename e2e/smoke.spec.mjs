// SPEC-2.md 2.5 smoke test: start the real app, import a statement,
// categorize an operation, restart, and check the category survived.
// samples/ is gitignored (real bank data) — the test skips itself with a
// clear message when it isn't present, same convention as the vitest suite.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLES_DIR = path.resolve(__dirname, "../samples/Kaspi");

function findSampleFile() {
  if (!fs.existsSync(SAMPLES_DIR)) return null;
  const file = fs.readdirSync(SAMPLES_DIR).find((f) => f.endsWith(".pdf"));
  return file ? path.join(SAMPLES_DIR, file) : null;
}

describe("Dinero smoke test", () => {
  let samplePath;

  before(function () {
    samplePath = findSampleFile();
    if (!samplePath) {
      console.log(
        "No samples/Kaspi/*.pdf found — skipping (samples/ holds real bank statements and is gitignored).",
      );
      this.skip();
    }
  });

  it("imports a statement, categorizes it, and keeps the category after a restart", async () => {
    // The native "choose a file" dialog the real import button opens can't
    // be driven by WebDriver — the test calls the same import logic
    // directly instead, through src/testHooks.ts.
    const result = await browser.executeAsync((filePath, done) => {
      window.__dinero_e2e.importFile(filePath).then(done);
    }, samplePath);
    if (result.status !== "imported" && result.status !== "duplicate_file") {
      throw new Error(`unexpected import result: ${JSON.stringify(result)}`);
    }

    await $("button=Категории + Операции").click();
    await browser.waitUntil(async () => (await $$("tbody tr")).length > 0, {
      timeout: 10000,
      timeoutMsg: "no rows showed up in the operations table after import",
    });

    const firstRow = await $("tbody tr");
    await firstRow.$(".category-cell").click();
    await firstRow.$(".category-input input").setValue("Смоук-тест");
    await browser.keys("Enter");

    await browser.waitUntil(
      async () => (await firstRow.$(".category-cell").getText()).includes("Смоук-тест"),
      { timeout: 5000, timeoutMsg: "category was not saved to the first row" },
    );

    // A fresh WebDriver session means tauri-driver closes this app process
    // and launches a new one — the same restart the spec criterion asks for.
    await browser.reloadSession();

    await $("button=Категории + Операции").click();
    await browser.waitUntil(async () => (await $$("tbody tr")).length > 0, {
      timeout: 10000,
      timeoutMsg: "no rows showed up in the operations table after restart",
    });
    const categoryAfterRestart = await $("tbody tr .category-cell").getText();
    if (!categoryAfterRestart.includes("Смоук-тест")) {
      throw new Error(`category did not survive the restart: "${categoryAfterRestart}"`);
    }
  });
});
