/**
 * esbuild bundler for Perplexity Auto-Rename.
 * - `extension/background.js` -> ESM (MV3 `"type": "module"` service worker)
 * - `extension/content.js`    -> IIFE (isolated-world content script + pixel theme & toaster)
 * - `extension/page.js`       -> IIFE (MAIN-world page script)
 * - `extension/options.js`    -> IIFE (full options page controller)
 * - `extension/popup.js`      -> IIFE (quick toolbar popup controller)
 */

import * as esbuild from "esbuild";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(rootDir, "extension");
mkdirSync(outDir, { recursive: true });

const shared = {
  bundle: true,
  target: ["chrome116"],
  charset: "utf8",
  legalComments: "none",
  logLevel: "info",
};

await Promise.all([
  esbuild.build({
    ...shared,
    entryPoints: [resolve(rootDir, "src/background/service-worker.js")],
    outfile: resolve(outDir, "background.js"),
    format: "esm",
  }),
  esbuild.build({
    ...shared,
    entryPoints: [resolve(rootDir, "src/content/content.js")],
    outfile: resolve(outDir, "content.js"),
    format: "iife",
  }),
  esbuild.build({
    ...shared,
    entryPoints: [resolve(rootDir, "src/page/inject.js")],
    outfile: resolve(outDir, "page.js"),
    format: "iife",
  }),
  esbuild.build({
    ...shared,
    entryPoints: [resolve(rootDir, "src/options/options.js")],
    outfile: resolve(outDir, "options.js"),
    format: "iife",
  }),
  esbuild.build({
    ...shared,
    entryPoints: [resolve(rootDir, "src/popup/popup.js")],
    outfile: resolve(outDir, "popup.js"),
    format: "iife",
  }),
]);
