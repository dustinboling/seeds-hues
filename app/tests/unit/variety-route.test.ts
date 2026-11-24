/**
 * Slice 3 route decisions: the static redirect map (pure URL function, no
 * data) and the variety route resolver (slug validation, detail read,
 * merged redirect, 404) against the fake catalog. The Vike layers
 * (+onBeforeRoute, +data) are thin throws over these; the HTTP suite proves
 * the wire behavior on the built artifact.
 */
import { describe, expect, it } from "vitest";
import { createDataCache } from "../../src/data/cache";
import { pathsForTag } from "../../src/data/revalidate";
import { isVarietySlug, legacySlug, redirectForUrl } from "../../src/server/redirects";
import { resolveVarietyRoute } from "../../src/server/variety-route";
import { createFakeCatalogApi, fakeCatalogState } from "./fake-catalog";

describe("slug validation", () => {
  it("accepts kebab-case slugs and rejects everything else", () => {
    for (const slug of ["a", "a-1", "sweet-pea-kings-ransom", "cosmos2"]) expect(isVarietySlug(slug)).toBe(true);
    for (const slug of ["", "UPPER", "Bad_Slug", "-lead", "trail-", "a--b", "with space", "dot.slug", "Ünïcodé"]) {
      expect(isVarietySlug(slug), JSON.stringify(slug)).toBe(false);
    }
  });

  it("recovers legacy ?v= slugs (trim, lowercase, validate, cap at 160)", () => {
    expect(legacySlug("sweet-pea-kings-ransom")).toBe("sweet-pea-kings-ransom");
    expect(legacySlug("  Sweet-Pea-Kings-Ransom  ")).toBe("sweet-pea-kings-ransom");
    expect(legacySlug(["a", "b"])).toBe("a");
    expect(legacySlug(undefined)).toBeNull();
    expect(legacySlug("")).toBeNull();
    expect(legacySlug("bad_slug!")).toBeNull();
    expect(legacySlug("a".repeat(161))).toBeNull();
    expect(legacySlug("a".repeat(160))).toBe("a".repeat(160));
  });
});

describe("static redirect map (all 301, one hop)", () => {
  it("redirects plural legacy paths to their singular canonicals", () => {
    expect(redirectForUrl("https://seeds.hues.flowers/varieties/sweet-pea-kings-ransom")).toBe(
      "/variety/sweet-pea-kings-ransom",
    );
    expect(redirectForUrl("https://seeds.hues.flowers/varieties")).toBe("/variety");
  });

  it("redirects legacy ?v= slugs to the variety page", () => {
    expect(redirectForUrl("https://seeds.hues.flowers/variety?v=sweet-pea-kings-ransom")).toBe(
      "/variety/sweet-pea-kings-ransom",
    );
    expect(redirectForUrl("https://seeds.hues.flowers/variety?v=%20Sweet-Pea%20")).toBe("/variety/sweet-pea");
  });

  it("redirects the internal small-farms path to the public filtered URL", () => {
    expect(redirectForUrl("https://seeds.hues.flowers/variety/sweet-pea-kings-ransom/small-farms")).toBe(
      "/variety/sweet-pea-kings-ransom?small_farm=true",
    );
  });

  it("leaves live routes, garbage params, and malformed slugs alone (no redirect)", () => {
    for (const url of [
      "https://seeds.hues.flowers/variety/sweet-pea-kings-ransom",
      "https://seeds.hues.flowers/variety/sweet-pea-kings-ransom?small_farm=true",
      "https://seeds.hues.flowers/variety/sweet-pea-kings-ransom?small_farm=yes",
      "https://seeds.hues.flowers/variety",
      "https://seeds.hues.flowers/variety?v=bad_slug!",
      "https://seeds.hues.flowers/variety?v=",
      "https://seeds.hues.flowers/variety/BAD-SLUG/small-farms",
      "https://seeds.hues.flowers/varieties/BAD-SLUG",
      "https://seeds.hues.flowers/seller/blue-ridge-seeds",
      "https://seeds.hues.flowers/",
    ]) {
      expect(redirectForUrl(url), url).toBeNull();
    }
  });
});

describe("variety route resolver", () => {
  const setup = () => {
    const state = fakeCatalogState();
    return { state, api: createFakeCatalogApi(state), cache: createDataCache() };
  };

  it("resolves the with-sellers page with its crop siblings", async () => {
    const { api, cache } = setup();
    const resolved = await resolveVarietyRoute(api, cache, { slug: "sweet-pea-kings-ransom", search: "" });
    expect(resolved.kind).toBe("ok");
    if (resolved.kind !== "ok") throw new Error("unreachable");
    expect(resolved.detail.slug).toBe("sweet-pea-kings-ransom");
    expect(resolved.detail.listings).toHaveLength(3);
    expect(resolved.smallFarmOnly).toBe(false);
    // The availability order, applied read-side (the public API has no
    // availability sort): in-stock first by sellers desc, then unlisted.
    expect(resolved.siblings.map((s) => s.slug)).toEqual([
      "sweet-pea-blue-ribbon",
      "sweet-pea-giant-wave",
      "sweet-pea-rose-queen",
    ]);
  });

  it("parses the small-farms variant forgivingly (exactly one 'true' is on)", async () => {
    const { api, cache } = setup();
    for (const search of ["?small_farm=true", "?x=1&small_farm=true"]) {
      const resolved = await resolveVarietyRoute(api, cache, { slug: "sweet-pea-kings-ransom", search });
      expect(resolved.kind).toBe("ok");
      if (resolved.kind === "ok") expect(resolved.smallFarmOnly, search).toBe(true);
    }
    for (const search of ["", "?small_farm=yes", "?small_farm=false", "?small_farm=true&small_farm=true", "?other=1"]) {
      const resolved = await resolveVarietyRoute(api, cache, { slug: "sweet-pea-kings-ransom", search });
      expect(resolved.kind).toBe("ok");
      if (resolved.kind === "ok") expect(resolved.smallFarmOnly, search).toBe(false);
    }
  });

  it("404s unknown and malformed slugs (never a redirect, never the shell)", async () => {
    const { api, cache } = setup();
    for (const slug of ["definitely-not-a-variety", "Bad_Slug", "UPPER", "-lead", "", "a--b"]) {
      const resolved = await resolveVarietyRoute(api, cache, { slug, search: "" });
      expect(resolved.kind, slug).toBe("notFound");
    }
  });

  it("301s merged slugs to the survivor, preserving ?small_farm=true", async () => {
    const { api, cache } = setup();
    expect(await resolveVarietyRoute(api, cache, { slug: "sweet-pea-old-ransom", search: "" })).toEqual({
      kind: "redirect",
      location: "/variety/sweet-pea-kings-ransom",
    });
    expect(await resolveVarietyRoute(api, cache, { slug: "sweet-pea-old-ransom", search: "?small_farm=true" })).toEqual({
      kind: "redirect",
      location: "/variety/sweet-pea-kings-ransom?small_farm=true",
    });
    expect(
      await resolveVarietyRoute(api, cache, { slug: "sweet-pea-old-ransom", search: "?small_farm=yes" }),
    ).toEqual({ kind: "redirect", location: "/variety/sweet-pea-kings-ransom" });
  });

  it("reads through the shared cache: stale until the variety tag purges, fresh after", async () => {
    const { state, api, cache } = setup();
    const first = await resolveVarietyRoute(api, cache, { slug: "sweet-pea-kings-ransom", search: "" });
    expect(first.kind).toBe("ok");
    state.details["sweet-pea-kings-ransom"]!.listings[0]!.availability = "sold_out";
    const stale = await resolveVarietyRoute(api, cache, { slug: "sweet-pea-kings-ransom", search: "" });
    expect(stale.kind).toBe("ok");
    if (stale.kind === "ok") expect(stale.detail.listings[0]!.availability).toBe("in_stock");
    const purged = cache.invalidatePaths(pathsForTag("variety:sweet-pea-kings-ransom"));
    expect(purged.length).toBeGreaterThan(0);
    const fresh = await resolveVarietyRoute(api, cache, { slug: "sweet-pea-kings-ransom", search: "" });
    expect(fresh.kind).toBe("ok");
    if (fresh.kind === "ok") expect(fresh.detail.listings[0]!.availability).toBe("sold_out");
  });
});
