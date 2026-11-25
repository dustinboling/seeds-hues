// Provenance-reproducible image-manifest sync (run manually; output committed).
// Encodes IMAGE_KEYS from v2/lib/images-data.ts (the migration manifest)
// into src/lib/images-data.ts so this tree renders artwork through our own
// image zone with zero drift from the live mapping.
//
// Closed-world encoding (Slice 8 repair: the verbatim 1062-entry table cost
// ~12 KB gzipped in every client bundle): .webp paths whose original is the
// .png twin collapse to a membership set (the twin is derived, never
// stored); true key overrides stay explicit; identity entries are dropped
// (lib/images.ts falls back to identity for unmapped paths). The encoding
// resolves identically to v2's table for every v2 entry — asserted here at
// sync time (conservation + spot resolution) and on every verify run by
// tests/unit/image-manifest.test.ts.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "../v2/lib/images-data.ts"), "utf8");
const match = /export const IMAGE_KEYS[^{]*\{([\s\S]*?)\n\}\);/.exec(source);
if (!match) throw new Error("IMAGE_KEYS table not found in v2/lib/images-data.ts");
const body = match[1];
const entries = [...body.matchAll(/"([^"]+)": "([^"]+)"/g)].map((e) => [e[1], e[2]]);
if (entries.length < 1000) throw new Error(`suspicious entry count: ${entries.length}`);

const twins = [];
const overrides = [];
let identities = 0;
for (const [path, key] of entries) {
  if (key === path.slice(1)) {
    identities++;
    continue; // Identity: lib/images.ts falls back to it for unmapped paths.
  }
  if (path.endsWith(".webp") && key === `${path.slice(1, -".webp".length)}.png`) {
    twins.push(path);
    continue;
  }
  overrides.push([path, key]);
}
// Conservation: every v2 entry lands in exactly one bucket.
if (twins.length + overrides.length + identities !== entries.length) {
  throw new Error("manifest buckets do not conserve the v2 entry count — refusing to write");
}
// Spot-resolve every v2 entry through the encoded form (the same resolution
// lib/images.ts performs): any drift fails the sync loudly.
const twinSet = new Set(twins);
const overrideMap = new Map(overrides);
const resolve = (path) => {
  if (overrideMap.has(path)) return overrideMap.get(path);
  if (path.endsWith(".webp") && twinSet.has(path)) return `${path.slice(1, -".webp".length)}.png`;
  return path.slice(1);
};
for (const [path, key] of entries) {
  if (resolve(path) !== key) throw new Error(`encoding drift for ${path}: ${resolve(path)} !== ${key}`);
}

const out = `/**
 * SYNCED by scripts/sync-image-keys.mjs from ../v2/lib/images-data.ts — do not edit by hand.
 * Closed-world encoding of v2's ${entries.length}-entry manifest: .webp stored paths whose
 * original is the .png twin (${twins.length}), plus true key overrides (${overrides.length}).
 * Identity entries (${identities}) are omitted — lib/images.ts falls back to identity.
 * Read through lib/images.ts only. Equivalence with v2's table is asserted
 * at sync time (above) and on every run by tests/unit/image-manifest.test.ts.
 */
export const PNG_TWIN_PATHS: ReadonlySet<string> = new Set([
${twins.map((p) => `  ${JSON.stringify(p)},`).join("\n")}
]);

export const KEY_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
${overrides.map(([p, k]) => `  ${JSON.stringify(p)}: ${JSON.stringify(k)},`).join("\n")}
});
`;
const dest = join(root, "src/lib/images-data.ts");
writeFileSync(dest, out);
console.log(
  `wrote src/lib/images-data.ts (${entries.length} v2 entries → ${twins.length} twins + ${overrides.length} overrides + ${identities} identities omitted, sha256 ${createHash("sha256").update(out).digest("hex").slice(0, 16)})`,
);
