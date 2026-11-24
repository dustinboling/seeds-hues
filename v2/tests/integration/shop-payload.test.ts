/**
 * Seller-as-shop payload completions (register S-10, G-5, L-7) on a throwaway D1
 * (Miniflare): per-listing facet fields on the seller payload, browse-side cropMedia,
 * the seller contact/location fields, and the standing no-price discipline over the
 * new/changed payloads.
 *
 * Non-vacuity (T-A): fails on pre-build code — the facet, cropMedia, contact, and
 * locations fields do not exist there.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices, type Services as ServicesType } from "@/lib/services";

let t: TestD1;
let s: ServicesType;

beforeAll(async () => {
  t = await createTestD1();
  s = createServices(t.db, { snapshots: t.env.SNAPSHOTS });
}, 180_000);

afterAll(async () => {
  await t?.dispose();
});

describe("S-10: per-listing facet fields on the seller payload", () => {
  it("every listing carries its crop's life cycle and its variety's color family", async () => {
    const d = await s.catalog.getSeller("songbird-seed-co");
    expect(d).not.toBeNull();
    expect(d!.listings.length).toBeGreaterThan(0);
    for (const l of d!.listings) {
      expect(typeof l.variety.plant.lifeCycle === "string" || l.variety.plant.lifeCycle === null, l.variety.slug).toBe(true);
      expect(typeof l.variety.colorFamily, l.variety.slug).toBe("string");
      expect(l.variety.colorFamily.length).toBeGreaterThan(0);
    }
    // The facet block is exactly season + methods (already shipped) + life cycle + color
    // family — spot-check the shipped pair is still there, unchanged.
    expect(d!.listings[0]!.variety.plant).toHaveProperty("season_class");
    expect(d!.listings[0]!.variety.plant).toHaveProperty("sowing_methods");
  });

  it("the seller payload carries contact fields (null when unpublished) and locations ([] when none)", async () => {
    const d = await s.catalog.getSeller("songbird-seed-co");
    expect(d).not.toBeNull();
    expect(d!.customerServicePhone).toBeNull();
    expect(d!.customerServiceEmail).toBeNull();
    expect(d!.locations).toEqual([]);
    // Never omitted: the keys exist on the parsed object.
    expect("customerServicePhone" in d!).toBe(true);
    expect("customerServiceEmail" in d!).toBe(true);
    expect("locations" in d!).toBe(true);
  });

  it("written contact + locations read back through getSeller", async () => {
    await s.admin.sellerContactUpdate("summertime-seed-co", {
      customerServicePhone: "(800) 555-0147",
      customerServiceEmail: "service@example.test",
    });
    await s.admin.sellerLocationsReplace("summertime-seed-co", [
      { kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023", is_primary: false, source_url: "https://example.test/contact", checked_date: "2026-11-22" },
      { kind: "physical", street: null, city: "Chimacum", state: "WA", zip: null, is_primary: true, source_url: "https://example.test/contact", checked_date: "2026-11-22" },
    ]);
    const d = await s.catalog.getSeller("summertime-seed-co");
    expect(d!.customerServicePhone).toBe("(800) 555-0147");
    expect(d!.customerServiceEmail).toBe("service@example.test");
    // §5.2 order: the primary first even though it was inserted second.
    expect(d!.locations).toEqual([
      { kind: "physical", street: null, city: "Chimacum", state: "WA", zip: null, isPrimary: true },
      { kind: "mailing", street: "226 West Ojai Ave Ste 101-539", city: "Ojai", state: "CA", zip: "93023", isPrimary: false },
    ]);
  });

  it("kind-undetermined rows are stored but never shipped", async () => {
    await s.admin.sellerLocationsReplace("wild-west-seed", [
      { kind: "physical", street: null, city: "Independence", state: "OR", zip: null, is_primary: true, source_url: "https://example.test/c", checked_date: "2026-11-22" },
      { kind: null, street: null, city: "Seattle", state: "WA", zip: null, is_primary: false, source_url: "https://example.test/c", checked_date: "2026-11-22" },
    ]);
    const d = await s.catalog.getSeller("wild-west-seed");
    expect(d!.locations).toEqual([
      { kind: "physical", street: null, city: "Independence", state: "OR", zip: null, isPrimary: true },
    ]);
  });

  it("locations order primary-first, then kind, then state, then city", async () => {
    await s.admin.sellerLocationsReplace("blomma-flower-farm", [
      { kind: "mailing", street: null, city: "Ojai", state: "CA", zip: null, is_primary: false, source_url: "https://example.test/c", checked_date: "2026-11-22" },
      { kind: "physical", street: null, city: "Bend", state: "OR", zip: null, is_primary: false, source_url: "https://example.test/c", checked_date: "2026-11-22" },
      { kind: "warehouse", street: null, city: "Reno", state: "NV", zip: null, is_primary: true, source_url: "https://example.test/c", checked_date: "2026-11-22" },
      { kind: "physical", street: null, city: "Ashland", state: "OR", zip: null, is_primary: false, source_url: "https://example.test/c", checked_date: "2026-11-22" },
    ]);
    const d = await s.catalog.getSeller("blomma-flower-farm");
    expect(d!.locations.map((l) => [l.kind, l.state, l.city, l.isPrimary])).toEqual([
      ["warehouse", "NV", "Reno", true],
      ["physical", "OR", "Ashland", false],
      ["physical", "OR", "Bend", false],
      ["mailing", "CA", "Ojai", false],
    ]);
  });

  it("the private contact_email never appears in the seller payload", async () => {
    await t.env.DB.prepare("UPDATE sellers SET contact_email = 'private@songbird.example' WHERE slug = 'songbird-seed-co'").run();
    const d = await s.catalog.getSeller("songbird-seed-co");
    expect(JSON.stringify(d)).not.toContain("private@songbird.example");
    expect(JSON.stringify(d)).not.toMatch(/contact_email/);
  });
});

describe("G-5: browse-side cropMedia", () => {
  it("every VarietyListItem carries cropMedia ([] when none, never omitted)", async () => {
    const { items, total } = await s.catalog.listVarieties({ page: { offset: 0, limit: 24 } });
    expect(total).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(0);
    for (const v of items) {
      expect(Array.isArray(v.cropMedia), v.slug).toBe(true);
      expect("cropMedia" in v, v.slug).toBe(true);
    }
  });
});

describe("no price field anywhere in the new/changed payloads", () => {
  it("getSeller + listVarieties payloads carry no price-shaped key", async () => {
    const d = await s.catalog.getSeller("songbird-seed-co");
    expect(JSON.stringify(d)).not.toMatch(/"price\w*":/i);
    const { items } = await s.catalog.listVarieties({ page: { offset: 0, limit: 24 } });
    expect(JSON.stringify(items)).not.toMatch(/"price\w*":/i);
  });
});
