/**
 * Tranche 3.1b-1 — existence/consumption census (repair 2, Quinn's F4).
 *
 * The PR #50 build failed the gate with two missing routes and two unbuilt surfaces while
 * 69 files / 1,174 tests passed: no test censused that a named endpoint exists or that a
 * named surface consumes the machinery. This file is that census, in the
 * tranche-2-3-chips.test.ts static-census tradition — source censuses over the real files,
 * no mocked filesystem:
 *
 * - Route existence: for every /api/browse/… path a browse component fetches (each
 *   API_PATH in the browse layer), a route file exists at the matching
 *   app/api/browse/…/route.ts.
 * - Surface consumption: each 3.1b-1 surface — home (app/page.tsx), the /crop index
 *   (app/crop/page.tsx), /search (app/search/page.tsx) — actually renders a browse
 *   component that consumes the shared machinery (a useInPlaceBrowse/browseInPlaceConfig
 *   call in its source — not merely a type import).
 *
 * Non-vacuity: fails against the pre-completion tree — CropBrowse fetches /api/browse/crops
 * with no route file, and home + /search render plain links, not the machinery.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

function walk(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const p = join(dir, name);
    if (statSync(join(ROOT, p)).isDirectory()) out.push(...walk(p, ext));
    else if (ext.test(name)) out.push(p);
  }
  return out;
}

/** Every (file, path) pair where a browse component names the endpoint it fetches. */
function fetchedBrowsePaths(): { file: string; path: string }[] {
  const out: { file: string; path: string }[] = [];
  for (const file of walk("components", /\.tsx$/)) {
    const src = read(file);
    for (const m of src.matchAll(/const API_PATH = "(\/api\/browse\/[a-z]+)"/g)) {
      out.push({ file, path: m[1]! });
    }
  }
  return out;
}

describe("3.1b-1 route existence (every fetched browse endpoint has its route file)", () => {
  it("finds browse endpoints in the tree (the census is not vacuous)", () => {
    const found = fetchedBrowsePaths();
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((f) => f.path)).toContain("/api/browse/varieties");
  });

  it("every fetched browse path has its route file", () => {
    const found = fetchedBrowsePaths();
    expect(found.length).toBeGreaterThan(0);
    for (const { file, path } of found) {
      const routeFile = join("app", path, "route.ts");
      expect(existsSync(join(ROOT, routeFile)), `${file} fetches ${path} but ${routeFile} does not exist`).toBe(true);
    }
  });
});

/** Local names a surface file imports as values from one @/components module. */
function valueImportsFrom(fromStmt: string): string[] {
  const named = /import\s*\{([^}]*)\}\s*from/.exec(fromStmt)?.[1] ?? "";
  const out: string[] = [];
  for (const part of named.split(",")) {
    const name = part.trim();
    if (!name || name.startsWith("type ")) continue;
    const local = /as\s+([A-Za-z0-9_]+)\s*$/.exec(name)?.[1] ?? name;
    out.push(local);
  }
  const def = /import\s+([A-Za-z0-9_]+)\s+from/.exec(fromStmt)?.[1];
  if (def) out.push(def);
  return out;
}

/**
 * The browse components a surface page renders that consume the shared in-place machinery:
 * imported as values from @/components, used as JSX (<Name …>), and calling
 * useInPlaceBrowse/browseInPlaceConfig in their own source (a type-only import counts for
 * nothing — the call is the consumption).
 */
function machineryConsumers(surfaceFile: string): string[] {
  const src = read(surfaceFile);
  const out: string[] = [];
  for (const m of src.matchAll(/import\s+[^;]*?from\s+"@\/components\/([^"]+)"/g)) {
    const mod = m[1]!;
    const stmt = m[0];
    const file = ["tsx", "ts"].map((e) => join("components", `${mod}.${e}`).replace(/\\/g, "/")).find((f) => existsSync(join(ROOT, f)));
    if (!file) continue;
    const usesMachinery = /useInPlaceBrowse\(|browseInPlaceConfig\(/.test(read(file));
    if (!usesMachinery) continue;
    for (const name of valueImportsFrom(stmt)) {
      if (new RegExp(`<${name}[\\s>/]`).test(src)) out.push(`${name} (${file})`);
    }
  }
  return out;
}

describe("3.1b-1 surface consumption (every surface renders the shared machinery)", () => {
  it("the shared machinery exports the in-place hook (the consumption check is not vacuous)", () => {
    const machinery = read("components/ui/InPlaceBrowse.tsx");
    expect(machinery).toContain("export function useInPlaceBrowse");
    expect(machinery).toContain("export function browseInPlaceConfig");
  });

  it.each([
    ["home", "app/page.tsx"],
    ["the /crop index", "app/crop/page.tsx"],
    ["/search", "app/search/page.tsx"],
  ])("%s (%s) renders a browse component consuming the shared machinery", (_label, surface) => {
    const consumers = machineryConsumers(surface);
    expect(consumers, `${surface} renders no browse component consuming the shared machinery`).not.toHaveLength(0);
  });
});
