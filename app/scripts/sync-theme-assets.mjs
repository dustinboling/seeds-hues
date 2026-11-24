// Provenance-reproducible theme-asset sync (run manually; outputs committed).
// Copies the same-origin theme assets the shell and templates reference
// (paper grain, stem motif, owner wordmark) byte-identical from v2/public/.
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = [
  ["../v2/public/theme/paper-grain.webp", "public/theme/paper-grain.webp"],
  ["../v2/public/theme/divider-stem.svg", "public/theme/divider-stem.svg"],
  ["../v2/public/brand/hues-logo.svg", "public/brand/hues-logo.svg"],
];

for (const [from, to] of FILES) {
  mkdirSync(join(root, dirname(to)), { recursive: true });
  copyFileSync(join(root, from), join(root, to));
  const hash = createHash("sha256").update(readFileSync(join(root, to))).digest("hex").slice(0, 16);
  console.log(`${to} (sha256 ${hash})`);
}
