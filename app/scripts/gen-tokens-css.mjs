// Regenerates src/design-system/tokens.css from the token mirror (same
// esbuild-on-the-fly pattern as gen-contrast.mjs).
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "gen-tokens-css-"));
try {
  const outfile = join(dir, "entry.cjs");
  buildSync({
    entryPoints: [join(root, "src/design-system/tokens-css.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "warning",
  });
  const mod = await import(pathToFileURL(outfile).href);
  const text = mod.renderTokensCss();
  if (typeof text !== "string" || text.length === 0) throw new Error("renderTokensCss() returned no text");
  writeFileSync(join(root, "src/design-system/tokens.css"), text);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log("wrote src/design-system/tokens.css");
