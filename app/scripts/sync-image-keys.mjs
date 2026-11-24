// Provenance-reproducible image-manifest sync (run manually; output committed).
// Extracts IMAGE_KEYS from v2/lib/images-data.ts (the migration manifest,
// 1062 entries) into src/lib/images-data.ts so this tree renders artwork
// through our own image zone with zero drift from the live mapping.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "../v2/lib/images-data.ts"), "utf8");
const match = /export const IMAGE_KEYS[^{]*\{([\s\S]*?)\n\}\);/.exec(source);
if (!match) throw new Error("IMAGE_KEYS table not found in v2/lib/images-data.ts");
const body = match[1];
const entries = [...body.matchAll(/"([^"]+)": "([^"]+)"/g)];
if (entries.length < 1000) throw new Error(`suspicious entry count: ${entries.length}`);
const out = `/**
 * SYNCED by scripts/sync-image-keys.mjs from ../v2/lib/images-data.ts — do not edit by hand.
 * Stored image path → key of the full-quality original in R2 bucket
 * seeds-hues-images, served at images.seeds.hues.flowers. ${entries.length} entries.
 * Read through lib/images.ts only.
 */
export const IMAGE_KEYS: Readonly<Record<string, string>> = Object.freeze({
${entries.map((e) => `  ${JSON.stringify(e[1])}: ${JSON.stringify(e[2])},`).join("\n")}
});
`;
const dest = join(root, "src/lib/images-data.ts");
writeFileSync(dest, out);
console.log(`wrote src/lib/images-data.ts (${entries.length} entries, sha256 ${createHash("sha256").update(out).digest("hex").slice(0, 16)})`);
