/**
 * Static redirect-map unit tests (Bea §8.4, the shipped rows): plural
 * legacy paths, legacy ?v=/?s= slugs, the internal small-farms path, and
 * the ?page=1 rule. The HTTP suite proves the wire behavior (301 + one
 * hop); these pin the pure mapping, including fall-throughs (live routes,
 * garbage params, malformed slugs → null, never a redirect).
 */
import { describe, expect, it } from "vitest";
import { isSlug, legacySlug, redirectForUrl } from "../../src/server/redirects";

describe("isSlug + legacySlug", () => {
  it("accepts catalog slugs only", () => {
    for (const slug of ["a", "a-1", "sweet-pea-kings-ransom", "blue-ridge-seeds"]) expect(isSlug(slug)).toBe(true);
    for (const slug of ["", "A", "a_b", "-a", "a-", "a--b", "a b"]) {
      expect(isSlug(slug), JSON.stringify(slug)).toBe(false);
    }
  });

  it("normalizes v1 query slugs (trim + lowercase, ≤160 chars, else null)", () => {
    expect(legacySlug("sweet-pea-kings-ransom")).toBe("sweet-pea-kings-ransom");
    expect(legacySlug("  Blue-Ridge-Seeds ")).toBe("blue-ridge-seeds");
    expect(legacySlug(["a", "b"])).toBe("a");
    expect(legacySlug("not a slug!")).toBeNull();
    expect(legacySlug("")).toBeNull();
    expect(legacySlug(undefined)).toBeNull();
  });
});

describe("redirectForUrl", () => {
  it("redirects plural legacy paths to their singular canonicals", () => {
    expect(redirectForUrl("/varieties")).toBe("/variety");
    expect(redirectForUrl("/varieties/sweet-pea-kings-ransom")).toBe("/variety/sweet-pea-kings-ransom");
    expect(redirectForUrl("/sellers")).toBe("/seller");
    expect(redirectForUrl("/sellers/blue-ridge-seeds")).toBe("/seller/blue-ridge-seeds");
    // Malformed plural slugs fall through (the route 404s them itself).
    expect(redirectForUrl("/varieties/BAD")).toBeNull();
    expect(redirectForUrl("/sellers/BAD")).toBeNull();
  });

  it("redirects legacy ?v=/?s= slugs to the detail page", () => {
    expect(redirectForUrl("/variety?v=sweet-pea-kings-ransom")).toBe("/variety/sweet-pea-kings-ransom");
    expect(redirectForUrl("/variety?v=%20Sweet-Pea-Kings-Ransom%20")).toBe("/variety/sweet-pea-kings-ransom");
    expect(redirectForUrl("/seller?s=blue-ridge-seeds")).toBe("/seller/blue-ridge-seeds");
    expect(redirectForUrl("/seller?s=%20Blue-Ridge-Seeds%20")).toBe("/seller/blue-ridge-seeds");
    // Garbage legacy values fall through (forgiving — never a redirect to garbage).
    expect(redirectForUrl("/variety?v=not+a+slug")).toBeNull();
    expect(redirectForUrl("/seller?s=not+a+slug")).toBeNull();
  });

  it("301s ?page=1 to the same URL minus the page param (other params kept)", () => {
    expect(redirectForUrl("/variety?page=1")).toBe("/variety");
    expect(redirectForUrl("/seller?page=1")).toBe("/seller");
    expect(redirectForUrl("/variety?color_family=yellow&page=1")).toBe("/variety?color_family=yellow");
    expect(redirectForUrl("/seller?state=OR&page=1")).toBe("/seller?state=OR");
    // The target carries no page param: the rule can never refire (one hop by construction).
    expect(redirectForUrl("/variety?color_family=yellow")).toBeNull();
  });

  it("reads only the FIRST page value (v2's parsePage rule)", () => {
    expect(redirectForUrl("/variety?page=2")).toBeNull();
    expect(redirectForUrl("/variety?page=2&page=1")).toBeNull();
    expect(redirectForUrl("/variety?page=1&page=2")).toBe("/variety");
    expect(redirectForUrl("/variety?page=abc")).toBeNull();
    expect(redirectForUrl("/seller?page=0")).toBeNull();
  });

  it("never serves the internal small-farms path (301 to the public URL)", () => {
    expect(redirectForUrl("/variety/sweet-pea-kings-ransom/small-farms")).toBe(
      "/variety/sweet-pea-kings-ransom?small_farm=true",
    );
    expect(redirectForUrl("/variety/BAD/small-farms")).toBeNull();
  });

  it("falls through live routes untouched", () => {
    for (const url of ["/", "/variety", "/variety?page=2", "/seller", "/seller?state=OR", "/search", "/search?q=x", "/crop"]) {
      expect(redirectForUrl(url), url).toBeNull();
    }
  });
});
