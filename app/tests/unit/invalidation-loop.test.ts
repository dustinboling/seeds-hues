/**
 * Slice 2 invalidation proof (F2 cure, committed): the brief's demonstration
 * as an executable test — change a variety count in the data source, and
 * /crop's data plus the affected sitemap segment reflect it WITHOUT a
 * rebuild, through the same loaders the +data hooks use and the same
 * revalidate handler the production Worker mounts. Mutable fake catalog;
 * no network, fully deterministic.
 */
import { describe, expect, it } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { loadCropIndexData } from "../../src/data/load";
import { generateMachineFiles } from "../../src/server/machine-files";
import { RevalidateAuthError, handleRevalidateHttpRequest } from "../../src/server/revalidate-handler";
import { createFakeCatalogApi, fakeCatalogState, fakeLastmodCache } from "./fake-catalog";

const SITE = "https://seeds.hues.flowers";
const SECRET = "test-revalidate-secret";

describe("invalidation loop (no rebuild)", () => {
  it("serves a changed variety count to /crop and the sitemap segment after a variety-tag revalidate", async () => {
    const state = fakeCatalogState();
    const api = createFakeCatalogApi(state);
    const cache = createDataCache();
    const lastmod = fakeLastmodCache();

    // Before: the crop carries 10 varieties; the listed segment has 1 URL.
    expect((await loadCropIndexData(api, cache)).crops.find((c) => c.slug === "sweet-pea")?.varietyCount).toBe(10);
    const before = await generateMachineFiles({ siteUrl: SITE, api, cache, lastmod });
    expect(before["sitemap-varieties-listed.xml"].match(/<url>/g)).toHaveLength(1);

    // The catalog write: a new listed variety appears; the crop's count moves 10 → 11.
    state.snapshot.varieties.push({ id: 4, slug: "sweet-pea-new-arrival", indexable: true, updated_seq: 23 });
    state.snapshot.listings.push({ id: 2, variety_id: 4, seller_id: 1 });
    state.snapshot.catalog_seq = 101;
    state.crops.find((c) => c.slug === "sweet-pea")!.varietyCount = 11;
    state.coverage.find((c) => c.crop.slug === "sweet-pea")!.varieties = 11;
    state.varietyDates["sweet-pea-new-arrival"] = "2026-11-24T00:00:00.000Z";

    // Stale reads first: the warm cache still serves the old count (the
    // staleness the hook exists to cure — the purge below must earn the flip).
    expect((await loadCropIndexData(api, cache)).crops.find((c) => c.slug === "sweet-pea")?.varietyCount).toBe(10);

    // The write path POSTs the variety tag (Bearer auth, v2 convention).
    const result = await handleRevalidateHttpRequest(
      { authorization: `Bearer ${SECRET}`, body: { tags: ["variety:sweet-pea-new-arrival"] } },
      { expectedSecret: SECRET, invalidatePaths: (paths) => cache.invalidatePaths(paths) },
    );
    expect(result.revalidated).toBe(true);
    expect(result.paths).toContain("/crop");
    expect(result.paths).toContain("/");
    expect(result.paths).toContain("/sitemap-varieties-listed.xml");
    expect(result.purged).toContain("crops");

    // After: /crop's data reads 11 and the regenerated segment carries the
    // new URL — no build ran between the write and these reads.
    expect((await loadCropIndexData(api, cache)).crops.find((c) => c.slug === "sweet-pea")?.varietyCount).toBe(11);
    const after = await generateMachineFiles({ siteUrl: SITE, api, cache, lastmod });
    expect(after["sitemap-varieties-listed.xml"].match(/<url>/g)).toHaveLength(2);
    expect(after["sitemap-varieties-listed.xml"]).toContain(`${SITE}/variety/sweet-pea-new-arrival`);
  });

  it("rejects a revalidate POST with a wrong or missing bearer secret", async () => {
    const cache = createDataCache();
    await expect(
      handleRevalidateHttpRequest(
        { authorization: "Bearer wrong", body: { tags: ["variety:x"] } },
        { expectedSecret: SECRET, invalidatePaths: (paths) => cache.invalidatePaths(paths) },
      ),
    ).rejects.toBeInstanceOf(RevalidateAuthError);
    await expect(
      handleRevalidateHttpRequest(
        { authorization: null, body: { tags: ["variety:x"] } },
        { expectedSecret: SECRET, invalidatePaths: (paths) => cache.invalidatePaths(paths) },
      ),
    ).rejects.toBeInstanceOf(RevalidateAuthError);
  });
});
