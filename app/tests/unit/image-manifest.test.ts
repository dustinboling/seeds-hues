/**
 * Slice 8 repair: the synced image manifest resolves identically to v2's
 * table for every v2 entry. The app stores a closed-world encoding (png
 * twins + overrides) at half the client bytes; this suite pins the
 * equivalence — and the sync's freshness — by resolving all of v2's
 * entries through the app's originalKey on every run. A v2 manifest edit
 * without a re-sync reds here by design (run scripts/sync-image-keys.mjs).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { KEY_OVERRIDES, PNG_TWIN_PATHS } from "../../src/lib/images-data";
import { imageUrl, originalKey } from "../../src/lib/images";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** v2's migration manifest, parsed the same way the sync script parses it. */
function v2Entries(): [string, string][] {
  const source = readFileSync(`${APP_ROOT}/../v2/lib/images-data.ts`, "utf8");
  const match = /export const IMAGE_KEYS[^{]*\{([\s\S]*?)\n\}\);/.exec(source);
  if (!match) throw new Error("IMAGE_KEYS table not found in v2/lib/images-data.ts");
  return [...match[1]!.matchAll(/"([^"]+)": "([^"]+)"/g)].map((e) => [e[1]!, e[2]!]);
}

describe("image manifest equivalence with v2", () => {
  it("resolves every v2 entry to v2's key (twins, overrides, and identities)", () => {
    const entries = v2Entries();
    expect(entries.length).toBeGreaterThan(1000);
    let twins = 0;
    let overrides = 0;
    let identities = 0;
    for (const [path, key] of entries) {
      expect(originalKey(path), path).toBe(key);
      if (Object.hasOwn(KEY_OVERRIDES, path)) overrides++;
      else if (PNG_TWIN_PATHS.has(path)) twins++;
      else identities++;
    }
    // Every bucket is populated (a degenerate encoding would show here).
    expect(twins).toBeGreaterThan(500);
    expect(overrides).toBeGreaterThan(0);
    expect(identities).toBeGreaterThan(0);
    expect(twins + overrides + identities).toBe(entries.length);
  });

  it("stays closed-world: unlisted .webp paths resolve to identity, never a guessed twin", () => {
    for (const path of ["/artwork/not-a-real-variety.webp", "/theme/not-a-real-hero.webp", "/artwork/deep/nested-missing.webp"]) {
      expect(PNG_TWIN_PATHS.has(path), `${path} unlisted`).toBe(false);
      expect(originalKey(path)).toBe(path.slice(1));
    }
  });

  it("renders transformation URLs off the resolved keys (mapped and unmapped)", () => {
    // A twin: the .png original feeds the transformation URL.
    expect(imageUrl("/artwork/ageratum-tall-blue-planet.webp", { width: 800 })).toBe(
      "https://images.seeds.hues.flowers/cdn-cgi/image/width=800,quality=80,format=auto,fit=scale-down/artwork/ageratum-tall-blue-planet.png",
    );
    // An override: the -v2 original feeds it.
    expect(imageUrl("/artwork/sweet-pea-balmoral.webp", { width: 640 })).toContain("artwork/sweet-pea-balmoral-v2.png");
    // Unmapped: identity key feeds it.
    expect(imageUrl("/artwork/not-a-real-variety.webp", { width: 640 })).toContain("/artwork/not-a-real-variety.webp");
  });

  it("rejects non-paths before any lookup (no fetchable string escapes)", () => {
    for (const bad of ["", "relative/path.webp", "https://evil.example/x.webp", "/artwork/../escape.webp", "/artwork/./dot.webp"]) {
      expect(() => originalKey(bad), JSON.stringify(bad)).toThrow(TypeError);
    }
  });
});
