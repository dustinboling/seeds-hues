/**
 * Tranche 3.4 §5.1 — home composition against the real seed catalog (real local D1): the
 * resting grid shows the top 12 crops computed from coverage data (varieties-with-sellers
 * descending, name ascending), Recently restocked sits above Browse by crop, and the
 * closing line counts the cap against the catalog total.
 *
 * Non-vacuity: fails on pre-build code — the grid renders all 124 A–Z crops with no cap,
 * no closing line, and Recently below Browse.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const store = vi.hoisted(() => ({ services: null as unknown }));
vi.mock("@/lib/services/context", () => ({ getServices: async () => store.services }));
// The search widget needs router context; the sections and grid do not.
vi.mock("@/components/search/SearchBox", () => ({ SearchBox: () => null }));

import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices } from "@/lib/services";

let t: TestD1;
beforeAll(async () => {
  t = await createTestD1();
  store.services = createServices(t.db);
});
afterAll(async () => {
  await t?.dispose();
});

const { default: HomePage } = await import("@/app/page");

/** Crop slugs in grid order: the grid's /crop/<slug> links (the bare /crop links excluded). */
function gridSlugs(html: string): string[] {
  return [...html.matchAll(/href="\/crop\/([a-z0-9-]+)"/g)].map((m) => m[1]!);
}

describe("home composition (§5.1) on the real catalog", () => {
  it("Recently restocked sits above Browse by crop", async () => {
    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
    const recent = html.indexOf('id="recent-title"');
    const crops = html.indexOf('id="crops-title"');
    const how = html.indexOf('id="how-title"');
    expect(recent).toBeGreaterThan(-1);
    expect(crops).toBeGreaterThan(-1);
    expect(recent).toBeLessThan(crops);
    expect(crops).toBeLessThan(how);
  });

  it("the resting cap's 12 slugs equal, in order, the top 12 from coverage data", async () => {
    const catalog = createServices(t.db).catalog;
    const coverage = await catalog.coverage();
    expect(coverage.length).toBeGreaterThan(12);
    const lower = (s: string): string => s.toLowerCase();
    const expected = [...coverage]
      .sort(
        (a, b) =>
          b.varieties_with_sellers - a.varieties_with_sellers ||
          (lower(a.crop.name) < lower(b.crop.name) ? -1 : lower(a.crop.name) > lower(b.crop.name) ? 1 : 0) ||
          (a.crop.slug < b.crop.slug ? -1 : a.crop.slug > b.crop.slug ? 1 : 0),
      )
      .slice(0, 12)
      .map((c) => c.crop.slug);
    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
    expect(gridSlugs(html)).toEqual(expected);
  });

  it("the closing line counts the cap against the catalog total and links /crop", async () => {
    const html = renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Showing 12 of 124 crops");
    expect(html).toMatch(/<a[^>]*href="\/crop"[^>]*>see all crops<\/a>/);
  });
});
