// Regenerates src/design-system/CONTRAST.md from the token mirror. The TS
// generator is bundled on the fly with esbuild (a devDependency) so the
// committed file always derives from the same code the tests exercise.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildSync } from "esbuild";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "gen-contrast-"));
try {
  const outfile = join(dir, "entry.cjs");
  buildSync({
    entryPoints: [join(root, "src/design-system/contrast-table.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile,
    logLevel: "warning",
  });
  const mod = await import(pathToFileURL(outfile).href);
  const text = mod.renderContrastTable();
  if (typeof text !== "string" || text.length === 0) throw new Error("renderContrastTable() returned no text");
  writeFileSync(join(root, "src/design-system/CONTRAST.md"), text);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log("wrote src/design-system/CONTRAST.md");
