/**
 * Worker-only build plugin: provides the virtual:og-assets module (see
 * server/og-assets.d.ts) behind the Worker's OG route. Loaded by
 * vite.worker.config.ts only — the main build never sees it.
 *
 * The module inlines the OG font bytes as base64 and statically imports
 * the two engine .wasm files (Satori's layout.wasm, resvg's
 * index_bg.wasm). The worker build keeps .wasm imports external, so
 * wrangler bundles them as precompiled WASM modules at deploy time —
 * workerd disallows dynamic WASM compilation, so inlined bytes could
 * never initialize there. The Worker entry decodes the fonts once per
 * isolate and passes the modules straight to the edge renderer.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:og-assets";
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, "..");

export function ogAssetsPlugin(): Plugin {
  let cached: string | null = null;
  return {
    name: "seeds-og-assets",
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      if (!cached) {
        const require = createRequire(join(appRoot, "package.json"));
        const yogaWasmPath = require.resolve("satori/layout.wasm");
        const resvgWasmPath = require.resolve("@resvg/resvg-wasm/index_bg.wasm");
        const b64 = (path: string): string => readFileSync(path).toString("base64");
        cached = [
          `import yogaWasmModule from ${JSON.stringify(yogaWasmPath)};`,
          `import resvgWasmModule from ${JSON.stringify(resvgWasmPath)};`,
          `export const geistBase64 = ${JSON.stringify(b64(join(appRoot, "src", "og", "fonts", "geist-regular.ttf")))};`,
          `export const frauncesBase64 = ${JSON.stringify(b64(join(appRoot, "src", "og", "fonts", "fraunces-og.ttf")))};`,
          `export { yogaWasmModule, resvgWasmModule };`,
          "",
        ].join("\n");
      }
      return cached;
    },
  };
}
