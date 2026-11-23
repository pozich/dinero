// WebdriverIO config for the Ф1 smoke test (SPEC-2.md 2.5), driven through
// tauri-driver — the officially documented way to drive a real Tauri window
// end to end. This needs two things installed on the machine running it,
// neither of which npm can fetch:
//   1. `cargo install tauri-driver`
//   2. the OS WebDriver for the system webview — on Linux that's
//      `WebKitWebDriver` (from the webkit2gtk package); on Windows it's
//      Microsoft Edge WebDriver, matching the installed Edge/WebView2 version.
// Neither was available in the sandbox this was written in, so this harness
// is written but not yet run end to end — see HANDOFF.md.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appBinary = path.resolve(
  __dirname,
  "../src-tauri/target/debug/dinero",
);

let tauriDriver;
// A fresh throwaway config dir per run — DINERO_CONFIG_DIR (src-tauri/src/
// vault.rs) makes the app treat it as both the vault pointer location and
// the default vault folder, so this test never touches the real one.
let testConfigDir;

export const config = {
  specs: ["./*.spec.mjs"],
  maxInstances: 1,
  capabilities: [
    {
      maxInstances: 1,
      "tauri:options": {
        application: appBinary,
      },
    },
  ],
  reporters: ["spec"],
  framework: "mocha",
  mochaOpts: {
    ui: "bdd",
    timeout: 60000,
  },

  // `tauri build` (not a raw `cargo build`) — the frontend is embedded into
  // the binary from `dist/` at compile time, and only the Tauri CLI runs
  // `beforeBuildCommand` (`npm run build`) first to regenerate it.
  // `--no-bundle` skips producing an installer, we only need the binary.
  onPrepare: () => {
    spawnSync("npx", ["tauri", "build", "--debug", "--no-bundle"], {
      stdio: "inherit",
      cwd: path.resolve(__dirname, ".."),
    });
  },

  beforeSession: () => {
    testConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "dinero-e2e-"));
    tauriDriver = spawn("tauri-driver", [], {
      stdio: [null, process.stdout, process.stderr],
      env: { ...process.env, DINERO_CONFIG_DIR: testConfigDir },
    });
  },

  afterSession: () => {
    tauriDriver?.kill();
    if (testConfigDir) {
      fs.rmSync(testConfigDir, { recursive: true, force: true });
    }
  },
};
