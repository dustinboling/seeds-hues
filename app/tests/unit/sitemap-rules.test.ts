/**
 * Sitemap rule pins (Bea §8.2): the buildSitemap design rules as mutation-
 * graded tests on a synthetic snapshot — pagination out, cohorts separate,
 * non-indexable/removed absent, lastmod real-or-omitted, hubs exact. These
 * pin the library Quinn execution-verified; the build test proves the same
 * rules on the generated output.
 */
import { describe, expect, it } from "vitest";
import { HUB_PATHS, buildSitemap } from "../../src/data/sitemap";
import type { LastmodCache, SyncSnapshotData } from "../../src/data/types";

const SITE = "https://seeds.hues.flowers";

const SNAPSHOT: SyncSnapshotData = {
  catalog_seq: 7,
  schema_version: 1,
  generated_at: "2026-11-24T00:00:00.000Z",
  crops: [{ id: 1, slug: "sweet-pea", updated_seq: 1 }],
  series: [{ id: 1, slug: "spencer-mix", updated_seq: 1 }],
  varieties: [
    { id: 1, slug: "listed-rose", indexable: true, updated_seq: 2 },
    { id: 2, slug: "lonely-bloom", indexable: true, updated_seq: 3 },
    { id: 3, slug: "hidden-draft", indexable: false, updated_seq: 4 },
  ],
  sellers: [
    { id: 1, slug: "visible-farm", region: "OR", country: "US", updated_seq: 5 },
    { id: 2, slug: "regionless-farm", region: null, country: "US", updated_seq: 6 },
  ],
  listings: [{ id: 1, variety_id: 1, seller_id: 1 }],
};

const LASTMOD: LastmodCache = {
  generated_at: "2026-11-24T00:00:00.000Z",
  catalog_seq: 7,
  varieties: {
    "listed-rose": { updated_at: "2026-11-20T00:00:00.000Z", updated_seq: 2 },
    "lonely-bloom": { updated_at: "2026-11-01T00:00:00.000Z", updated_seq: 0 },
  },
  sellers: {
    "visible-farm": { updated_at: "2026-11-18T00:00:00.000Z", updated_seq: 5 },
    "regionless-farm": { updated_at: "2026-11-17T00:00:00.000Z", updated_seq: 6 },
    "removed-farm": { updated_at: "2026-09-01T00:00:00.000Z", updated_seq: 1 },
  },
  series: {},
};

describe("buildSitemap rules (Bea §8.2)", () => {
  it("emits no pagination, filtered, or non-canonical URL anywhere", () => {
    const build = buildSitemap({ siteUrl: SITE, snapshot: SNAPSHOT, lastmod: LASTMOD });
    const bodies = [build.index, ...Object.values(build.files)];
    for (const body of bodies) {
      expect(body).not.toContain("page=");
      expect(body).not.toMatch(/<loc>[^<]*[?&]/);
    }
    // Mutation guard: the hubs table itself must never carry a parameter.
    for (const hub of HUB_PATHS) {
      expect(hub).not.toContain("?");
    }
    expect(HUB_PATHS).toContain("/add-your-farm");
    expect(HUB_PATHS).toHaveLength(11);
  });

  it("separates listed and zero-seller varieties and drops non-indexable rows", () => {
    const build = buildSitemap({ siteUrl: SITE, snapshot: SNAPSHOT, lastmod: LASTMOD });
    const listed = build.manifest["sitemap-varieties-listed.xml"].map((u) => u.loc);
    const zero = build.manifest["sitemap-varieties-zero-seller.xml"].map((u) => u.loc);
    expect(listed).toEqual([`${SITE}/variety/listed-rose`]);
    expect(zero).toEqual([`${SITE}/variety/lonely-bloom`]);
    const all = Object.values(build.manifest).flat().map((u) => u.loc);
    expect(all.join("\n")).not.toContain("hidden-draft");
  });

  it("never resurrects a removed seller from the stale lastmod cache", () => {
    const build = buildSitemap({ siteUrl: SITE, snapshot: SNAPSHOT, lastmod: LASTMOD });
    const sellers = build.manifest["sitemap-sellers.xml"].map((u) => u.loc);
    expect(sellers).toEqual([`${SITE}/seller/regionless-farm`, `${SITE}/seller/visible-farm`]);
  });

  it("emits lastmod only where the cached seq still verifies (real-or-omitted)", () => {
    const build = buildSitemap({ siteUrl: SITE, snapshot: SNAPSHOT, lastmod: LASTMOD });
    const listed = build.manifest["sitemap-varieties-listed.xml"];
    expect(listed[0]?.lastmod).toBe("2026-11-20T00:00:00.000Z");
    const zero = build.manifest["sitemap-varieties-zero-seller.xml"];
    expect(zero[0]?.lastmod).toBeUndefined();
    for (const file of ["sitemap-crops.xml", "sitemap-states.xml", "sitemap-hubs.xml"] as const) {
      for (const url of build.manifest[file]) expect(url.lastmod).toBeUndefined();
    }
  });

  it("lists a state page only for sellers with a mappable US region", () => {
    const build = buildSitemap({ siteUrl: SITE, snapshot: SNAPSHOT, lastmod: LASTMOD });
    expect(build.manifest["sitemap-states.xml"].map((u) => u.loc)).toEqual([`${SITE}/state/oregon`]);
  });
});
