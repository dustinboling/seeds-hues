/**
 * Tranche 3.1b-2 — existence/consumption census (Quinn's PR #54 F1/F2).
 *
 * PR #54 generalized the machinery and landed two well-formed lib modules while 73 files /
 * 1,211 tests passed — because no test censused that the two surfaces consume the machinery.
 * This file is that census, extending the 3.1b-1 pattern (tranche-3-1b1-census.test.ts) to the
 * crop detail rebuild and the seller State cloud, in the tranche-2-3-chips.test.ts
 * static-census tradition — source censuses over the real files, no mocked filesystem:
 *
 * - Route existence: for every /api/browse/… path the new surfaces fetch (the sellers
 *   endpoint and the per-crop endpoint), a route file exists at the matching
 *   app/api/browse/…/route.ts.
 * - Surface consumption: each 3.1b-2 surface — the crop page (app/crop/[slug]/page.tsx) and
 *   the seller index (app/seller/page.tsx) — actually renders a browse component that
 *   consumes the shared machinery (a useInPlaceBrowse call in its source — not merely a
 *   type import).
 * - Wiring specifics: the crop surface renders the three groups with multi-select Hue,
 *   swatch dots, counts and the pinned applied-row forms; the seller cloud joins the
 *   enhancement with the §2.6.2 single-remover form; both payload schemas have route
 *   consumers; the lib modules have page/component consumers.
 *
 * Non-vacuity: every test below fails against the PR #54 head — the routes, the browse
 * components and the wired pages do not exist there, and StateFilter is links-only.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");
const exists = (rel: string): boolean => existsSync(join(ROOT, rel));

describe("3.1b-2 route existence (every fetched browse endpoint has its route file)", () => {
  it("the seller surface fetches /api/browse/sellers and its route file exists", () => {
    const src = read("components/seller/SellerBrowse.tsx");
    expect(src, "SellerBrowse names no sellers endpoint (the census is not vacuous)").toContain('const API_PATH = "/api/browse/sellers"');
    expect(exists("app/api/browse/sellers/route.ts"), "SellerBrowse fetches /api/browse/sellers but its route file does not exist").toBe(
      true,
    );
  });

  it("the crop surface fetches /api/browse/crops/[slug] and its route file exists", () => {
    const src = read("components/crop/CropDetailBrowse.tsx");
    expect(src, "CropDetailBrowse names no crop endpoint (the census is not vacuous)").toContain('const API_BASE = "/api/browse/crops"');
    expect(
      exists("app/api/browse/crops/[slug]/route.ts"),
      "CropDetailBrowse fetches /api/browse/crops/[slug] but its route file does not exist",
    ).toBe(true);
  });

  it("both payload schemas have route consumers (no dead §2.5.6 contract)", () => {
    const sellers = read("app/api/browse/sellers/route.ts");
    expect(sellers, "no route consumes BrowseSellersPayloadSchema").toContain("BrowseSellersPayloadSchema");
    const crop = read("app/api/browse/crops/[slug]/route.ts");
    expect(crop, "no route consumes BrowseCropPayloadSchema").toContain("BrowseCropPayloadSchema");
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
 * useInPlaceBrowse in their own source (a type-only import counts for nothing — the call is
 * the consumption). Same rule as the 3.1b-1 census.
 */
function machineryConsumers(surfaceFile: string): string[] {
  const src = read(surfaceFile);
  const out: string[] = [];
  for (const m of src.matchAll(/import\s+[^;]*?from\s+"@\/components\/([^"]+)"/g)) {
    const mod = m[1]!;
    const stmt = m[0];
    const file = ["tsx", "ts"].map((e) => join("components", `${mod}.${e}`).replace(/\\/g, "/")).find((f) => exists(f));
    if (!file) continue;
    if (!/useInPlaceBrowse\(/.test(read(file))) continue;
    for (const name of valueImportsFrom(stmt)) {
      if (new RegExp(`<${name}[\\s>/]`).test(src)) out.push(`${name} (${file})`);
    }
  }
  return out;
}

describe("3.1b-2 surface consumption (every surface renders the shared machinery)", () => {
  it.each([
    ["crop detail", "app/crop/[slug]/page.tsx"],
    ["the seller index", "app/seller/page.tsx"],
  ])("%s (%s) renders a browse component consuming the shared machinery", (_label, surface) => {
    const consumers = machineryConsumers(surface);
    expect(consumers, `${surface} renders no browse component consuming the shared machinery`).not.toHaveLength(0);
  });
});

describe("3.1b-2 crop wiring (groups, multi-select Hue, dots, counts, applied row)", () => {
  it("renders the shared component with the three groups (sellers, hue, series)", () => {
    const page = read("app/crop/[slug]/page.tsx");
    expect(page, "the crop page renders no shared browse component").toContain("<CropDetailBrowse");
    const lib = read("lib/crop-detail.ts");
    expect(lib, "the crop group order drifted").toContain('["sellers", "hue", "series"]');
    const filters = read("components/crop/CropDetailFilters.tsx");
    for (const legend of ["Sellers", "Hue", "Series"]) {
      expect(filters, `the crop filters lost the ${legend} legend`).toContain(legend);
    }
    expect(page, "a hand-rolled filter row survived the rebuild").not.toContain("const chip = (label: string");
  });

  it("keeps the shipped URL parameters (color_family, series, has_sellers)", () => {
    const browse = read("components/crop/CropDetailBrowse.tsx");
    expect(browse, "the crop surface left the shared param vocabulary").toContain("cropFilterParams");
    const lib = read("lib/crop-detail.ts");
    for (const param of ["has_sellers", "color_family", "series"]) {
      expect(lib, `the crop param ${param} drifted`).toContain(`"${param}"`);
    }
  });

  it("Hue is multi-select (PB-2) with swatch dots and per-option counts", () => {
    const filters = read("components/crop/CropDetailFilters.tsx");
    expect(filters, "the crop Hue chips lost their swatch dots").toContain("SwatchDot");
    expect(filters, "the crop chips lost their per-option counts").toContain("CropChipCount");
    const lib = read("lib/crop-detail.ts");
    expect(lib, "the crop Hue toggle is gone (PB-2 multi-select)").toContain("toggleCropHue");
    const browse = read("components/crop/CropDetailBrowse.tsx");
    expect(browse, "the crop taps left the shared toggle transition").toContain("cropCountStateFor");
  });

  it("pins the applied-row forms (removers + Clear All) on the crop surface", () => {
    const browse = read("components/crop/CropDetailBrowse.tsx");
    expect(browse, "the crop surface renders no shared applied row").toContain("<InPlaceAppliedRow");
    expect(browse, "the crop surface dropped its Clear All").not.toContain("showClearAll={false}");
    expect(browse, "the crop removers left the shared transition").toContain("cropRemoversFor");
    const lib = read("lib/crop-detail.ts");
    expect(lib, "the crop remover label form drifted").toContain("`${g}: ${value}`");
    expect(lib, "the crop remover accessible-name form drifted").toContain("`Remove the ${g} filter, ${value}`");
  });

  it("keeps the crop count line, results region and empty states on the surface", () => {
    const browse = read("components/crop/CropDetailBrowse.tsx");
    expect(browse, "the crop count-line id is gone").toContain('id="crop-results-count"');
    expect(browse, "the crop results-region id is gone").toContain('id="crop-variety-results"');
    expect(browse, "the crop empty state is gone").toContain("No varieties match.");
    expect(browse, "the crop zero-seller state is gone").toContain("zeroSellerSentence");
    expect(browse, "Season became a filter").not.toContain('"season"');
  });
});

describe("3.1b-2 seller wiring (the cloud joins the enhancement, §2.6.2 form)", () => {
  it("the State cloud renders hydrated buttons (links floor + pressed controls)", () => {
    const cloud = read("components/seller/StateFilter.tsx");
    expect(cloud, "the cloud never upgraded to buttons (still links-only)").toContain("aria-pressed");
    expect(cloud, "the cloud lost its no-JS links floor").toContain("aria-current");
    expect(cloud, "the cloud lost its glyphs").toContain("StateShape");
    expect(cloud, "the cloud lost its All-states reset").toContain("All states");
    const page = read("app/seller/page.tsx");
    expect(page, "the seller page renders no shared browse component").toContain("<SellerBrowse");
  });

  it("the seller applied row is the §2.6.2 form (single State remover, no Clear All)", () => {
    const browse = read("components/seller/SellerBrowse.tsx");
    expect(browse, "the seller surface renders no shared applied row").toContain("<InPlaceAppliedRow");
    expect(browse, "Clear All leaked onto the §2.6.2 surface").toContain("showClearAll={false}");
    expect(browse, "the seller removers left the shared transition").toContain("sellerRemoversFor");
    const lib = read("lib/seller-browse.ts");
    expect(lib, "the seller remover label form drifted").toContain("`${SELLER_STATE_LEGEND}: ${name}`");
    expect(lib, "the seller remover accessible-name form drifted").toContain("`Remove the ${SELLER_STATE_LEGEND} filter, ${name}`");
    expect(lib, "the seller param drifted").toContain('"state"');
  });

  it("keeps the seller count line, legend placement, grid and pagination on the surface", () => {
    const browse = read("components/seller/SellerBrowse.tsx");
    expect(browse, "the seller count-line id is gone").toContain('id="seller-results-count"');
    expect(browse, "the seller results-region id is gone").toContain('id="seller-results"');
    expect(browse, "the Small Farm legend left the seller index").toContain("SmallFarmLegend");
    expect(browse, "the seller grid left the surface").toContain("SellerCard");
    expect(browse, "the seller pagination left the surface").toContain("<Pagination");
    const section = read("components/variety/SellerFilterSection.tsx");
    expect(section, "SellerFilterSection changed shape (it is not touched)").toContain("SellerFilterSection");
  });
});

describe("3.1b-2 lib consumption (the PR #54 modules have consumers)", () => {
  it("lib/crop-detail.ts is consumed by a page, a component and a route", () => {
    expect(read("app/crop/[slug]/page.tsx"), "the crop page ignores lib/crop-detail").toContain("lib/crop-detail");
    expect(read("components/crop/CropDetailBrowse.tsx"), "CropDetailBrowse ignores lib/crop-detail").toContain("lib/crop-detail");
    expect(read("app/api/browse/crops/[slug]/route.ts"), "the crop route ignores lib/crop-detail").toContain("lib/crop-detail");
  });

  it("lib/seller-browse.ts is consumed by a page, components and a route", () => {
    expect(read("app/seller/page.tsx"), "the seller page ignores lib/seller-browse").toContain("lib/seller-browse");
    expect(read("components/seller/SellerBrowse.tsx"), "SellerBrowse ignores lib/seller-browse").toContain("lib/seller-browse");
    expect(read("components/seller/StateFilter.tsx"), "StateFilter ignores lib/seller-browse").toContain("lib/seller-browse");
    expect(read("app/api/browse/sellers/route.ts"), "the sellers route ignores lib/seller-browse").toContain("lib/seller-browse");
  });
});
