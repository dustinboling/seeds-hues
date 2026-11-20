/**
 * State-flower plates (placement spec 2026-11-19, Nadia; Ada's Accessibility Ruling binding):
 * the slug-keyed plate table, the shared StatePlate component, and both placements — rendered
 * through the real seller and state page components against a fake in-process catalog.
 */
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STATE_PLATES, statePlateFor } from "@/lib/data/state-plates";
import { STATE_SCENES } from "@/lib/data/state-scenes";
import { US_STATES, stateBySlug } from "@/lib/data/states";
import { IMAGE_KEYS } from "@/lib/images-data";
import { StatePlate } from "@/components/seller/StatePlate";
import type { SellerDetail, SellerListItem, SellerState } from "@/lib/validators";

const fake = vi.hoisted(() => ({
  seller: null as unknown,
  states: [] as unknown[],
  list: { items: [] as unknown[], total: 0 },
}));
vi.mock("@/lib/services/context", () => ({
  getServices: async () => ({
    catalog: {
      getSeller: async () => fake.seller,
      listSellerStates: async () => fake.states,
      listSellers: async () => fake.list,
    },
  }),
}));

// Imported after the mock is registered (vi.mock is hoisted above these too).
const { default: SellerPage } = await import("@/app/seller/[slug]/page");
const { default: StatePage } = await import("@/app/state/[slug]/page");

/** Ada §A.2, copied verbatim: the bench's source of truth for the 16 strings. */
const ADA_A2: Record<string, string> = {
  california: "Golden poppy, California's state flower",
  colorado: "White and lavender columbine, Colorado's state flower",
  connecticut: "Mountain laurel, Connecticut's state flower",
  georgia: "Cherokee rose, Georgia's state flower",
  iowa: "Wild rose, Iowa's state flower",
  maine: "White pine cone and tassel, Maine's state floral emblem",
  minnesota: "Pink and white lady slipper, Minnesota's state flower",
  montana: "Bitterroot, Montana's state flower",
  nevada: "Sagebrush, Nevada's state flower",
  "new-york": "Rose, New York's state flower",
  oregon: "Oregon grape, Oregon's state flower",
  utah: "Sego lily, Utah's state flower",
  vermont: "Red clover, Vermont's state flower",
  virginia: "American dogwood, Virginia's state flower",
  washington: "Coast rhododendron, Washington's state flower",
  wisconsin: "Wood violet, Wisconsin's state flower",
};

const T = (width: number, key: string) =>
  `https://images.seeds.hues.flowers/cdn-cgi/image/width=${width},quality=80,format=auto,fit=scale-down/${key}`;
const attr = (tag: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const figureOf = (h: string) => /<figure\b[^>]*data-state-plate="[^"]*"[^>]*>[\s\S]*?<\/figure>/.exec(h)?.[0] ?? null;
const imgOf = (fig: string) => /<img\b[^>]*>/.exec(fig)?.[0] ?? "";
const preloadsOf = (h: string) => [...h.matchAll(/<link rel="preload" as="image"[^>]*>/g)].map((m) => m[0]);
const withoutPreloads = (h: string) => h.replace(/<link rel="preload" as="image"[^>]*>/g, "");
const decode = (s: string) => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');

/** The markup invariants every plate carries, whichever page it is on (§1.3–1.5, §A.3, §A.5). */
function expectPlate(fig: string, code: string, slug: string, loading: "eager" | "lazy") {
  const tag = imgOf(fig);
  expect(attr(fig, "data-state-plate")).toBe(code);
  expect(attr(fig, "class")).toBe("mx-auto mt-6 w-[280px] shrink-0 sm:mx-0 sm:mt-1 sm:w-[300px] lg:w-[320px]");
  expect(attr(tag, "src")).toBe(T(640, `artwork/states/${slug}.png`));
  expect(decode(attr(tag, "alt") ?? "")).toBe(ADA_A2[slug]);
  expect(attr(tag, "width")).toBe("1600");
  expect(attr(tag, "height")).toBe("1600");
  expect(attr(tag, "loading")).toBe(loading);
  expect(attr(tag, "decoding")).toBe("async");
  expect(attr(tag, "class")).toBe("art-frame h-auto w-full");
  // §A.5.3: fetchPriority omitted (never "low", never "high").
  expect(tag).not.toMatch(/fetchpriority/i);
  // §A.5.2 / §1.4: no title, no aria-label, no role/tabindex, no link/button, no hover/pointer.
  expect(fig).not.toMatch(/\btitle=|aria-label|aria-hidden|\brole=|tabindex|<a\b|<button\b|onclick|card-hover|cursor-pointer|hover:/i);
  // §1.5: no caption; §6.1: no crop utilities; §1.3: art-frame, never .card.
  expect(fig).not.toMatch(/<figcaption|object-cover|object-contain|aspect-|\bcard\b/);
  expect(fig).not.toMatch(/srcset/i);
}

const SELLER: SellerDetail = {
  slug: "willamette-test-farm",
  name: "Willamette Test Farm",
  type: "specialty",
  location: "Junction City, OR",
  region: "OR",
  country: "US",
  homepage: "https://willamette-test-farm.example/",
  ratingCount: 0,
  ratingAverage: null,
  rating: { state: "not_yet_rated", average: null, review_count: 0 },
  importedRating: null,
  isSmallFarm: false,
  description: "A test farm.",
  orderingNotes: null,
  varietyCount: 0,
  updatedAt: "2026-11-19T00:00:00.000Z",
  claimStatus: "unclaimed",
  shipsTo: ["US"],
  isSiteOwner: false,
  listings: [],
};

async function renderSeller(seller: SellerDetail): Promise<string> {
  fake.seller = seller;
  const el = (await SellerPage({ params: Promise.resolve({ slug: seller.slug }), searchParams: Promise.resolve({}) })) as ReactElement;
  return renderToStaticMarkup(el);
}

async function renderState(slug: string, sellers: SellerListItem[]): Promise<string> {
  const st = stateBySlug(slug)!;
  const state: SellerState = { ...st, sellerCount: sellers.length };
  fake.states = [state];
  fake.list = { items: sellers, total: sellers.length };
  const el = (await StatePage({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })) as ReactElement;
  return renderToStaticMarkup(el);
}

const header = (h: string) => /<header\b[^>]*>[\s\S]*?<\/header>/.exec(h)?.[0] ?? "";

beforeEach(() => {
  fake.seller = null;
  fake.states = [];
  fake.list = { items: [], total: 0 };
});

describe("plate table (lib/data/state-plates.ts)", () => {
  it("holds exactly the 16 painted states, every key a real state slug", () => {
    expect(Object.keys(STATE_PLATES).sort()).toEqual(Object.keys(ADA_A2).sort());
    expect(Object.keys(STATE_PLATES)).toHaveLength(16);
    for (const slug of Object.keys(STATE_PLATES)) expect(stateBySlug(slug)?.slug, slug).toBe(slug);
  });

  it("every alt is Ada §A.2 verbatim (Maine 'state floral emblem', Minnesota 'lady slipper')", () => {
    for (const [slug, alt] of Object.entries(ADA_A2)) expect(STATE_PLATES[slug]!.alt, slug).toBe(alt);
    expect(STATE_PLATES.maine!.alt).toContain("Maine's state floral emblem");
    expect(STATE_PLATES.minnesota!.alt).toContain("lady slipper");
    expect(STATE_PLATES.minnesota!.alt).not.toContain("lady's");
    for (const { alt } of Object.values(STATE_PLATES)) {
      expect(alt.trim()).toBe(alt);
      expect(alt).not.toMatch(/\.webp|\.png|\/|image of|painting of/i);
    }
  });

  it("every path is the stored /artwork/states/{slug}.webp the image CDN holds", () => {
    for (const [slug, plate] of Object.entries(STATE_PLATES)) {
      expect(plate.path).toBe(`/artwork/states/${slug}.webp`);
      expect(IMAGE_KEYS[plate.path]).toBe(`artwork/states/${slug}.png`);
    }
  });

  it("statePlateFor: own keys only; unpainted states, empty and prototype keys → null", () => {
    expect(statePlateFor("oregon")).toBe(STATE_PLATES.oregon);
    for (const v of ["texas", "ohio", "", null, undefined, "constructor", "__proto__", "toString", "Oregon"]) {
      expect(statePlateFor(v), String(v)).toBeNull();
    }
    const unpainted = US_STATES.filter((s) => !Object.hasOwn(ADA_A2, s.slug));
    expect(unpainted).toHaveLength(34);
    for (const s of unpainted) expect(statePlateFor(s.slug), s.slug).toBeNull();
  });
});

describe("StatePlate component", () => {
  it("renders the whole plate in .art-frame with the table's alt and the requested loading", () => {
    for (const loading of ["eager", "lazy"] as const) {
      const h = renderToStaticMarkup(createElement(StatePlate, { code: "ME", plate: STATE_PLATES.maine!, loading }));
      expect(withoutPreloads(h)).toMatch(/^<figure [^>]*>[\s\S]*<\/figure>$/);
      expectPlate(h, "ME", "maine", loading);
    }
  });

  // React 19 emits <link rel="preload" as="image"> for every non-lazy <img> (it hoists to <head>
  // in the app). For the eager seller-page plate that preload must stay at default priority — no
  // fetchpriority, exactly like the <img> (§A.5.3) — and a lazy plate gets no preload at all.
  it("eager plate: React's image preload is never promoted (no fetchpriority); lazy plate: no preload", () => {
    const eager = renderToStaticMarkup(createElement(StatePlate, { code: "OR", plate: STATE_PLATES.oregon!, loading: "eager" }));
    const pre = preloadsOf(eager);
    expect(pre).toHaveLength(1);
    expect(attr(pre[0]!, "href")).toBe(T(640, "artwork/states/oregon.png"));
    expect(pre[0]).not.toMatch(/fetchpriority/i);
    const lazy = renderToStaticMarkup(createElement(StatePlate, { code: "OR", plate: STATE_PLATES.oregon!, loading: "lazy" }));
    expect(preloadsOf(lazy)).toEqual([]);
  });
});

describe("seller page placement (§2)", () => {
  it("a painted-state seller gets its own state's plate, eager, after the summary inside <header>", async () => {
    const h = await renderSeller(SELLER);
    const head = header(h);
    expect(attr(head, "class")).toBe("sm:flex sm:items-start sm:gap-8");
    const fig = figureOf(head);
    expect(fig).not.toBeNull();
    expectPlate(fig!, "OR", "oregon", "eager");
    // DOM order: eyebrow → h1 → facts (state chip) → CTA → plate. Exactly one plate on the page.
    const at = (s: string) => head.indexOf(s);
    expect(at('<div class="min-w-0 flex-1">')).toBeGreaterThan(-1);
    expect(at("<h1")).toBeLessThan(at('data-seller-state="OR"'));
    expect(at('data-seller-state="OR"')).toBeLessThan(at("Visit Willamette Test Farm"));
    expect(at("Visit Willamette Test Farm")).toBeLessThan(at("<figure"));
    expect(h.match(/data-state-plate=/g)).toHaveLength(1);
    expect(withoutPreloads(h).match(/artwork\/states\//g)).toHaveLength(1);
    // The plate's React preload carries no fetchpriority (never promoted over the <h1> LCP).
    const platePreloads = preloadsOf(h).filter((l) => l.includes("artwork/states/"));
    expect(platePreloads).toHaveLength(1);
    expect(platePreloads[0]).not.toMatch(/fetchpriority/i);
    // About section stays after the header.
    expect(h.indexOf("</header>")).toBeLessThan(h.indexOf("About this seller"));
  });

  it("each painted state's seller gets that state's plate and alt, never another's", async () => {
    for (const slug of Object.keys(ADA_A2)) {
      const st = stateBySlug(slug)!;
      const fig = figureOf(await renderSeller({ ...SELLER, region: st.code, location: null }));
      expect(fig, slug).not.toBeNull();
      expectPlate(fig!, st.code, slug, "eager");
    }
  });

  it("no region on file (the David's Garden Seeds / Seedtime case) → no plate, header unchanged otherwise", async () => {
    const h = await renderSeller({ ...SELLER, region: null, location: null });
    expect(h).not.toMatch(/data-state-plate|<figure|artwork\/states|data-seller-state/);
    expect(header(h)).toContain('<div class="min-w-0 flex-1">');
  });

  it("a US state with no plate (Texas) → state chip as today, but no plate and no substitute", async () => {
    const h = await renderSeller({ ...SELLER, region: "TX", location: "Austin, TX" });
    expect(h).toContain('data-seller-state="TX"');
    expect(h).not.toMatch(/data-state-plate|<figure|artwork\/states|state-scenes|<img/);
  });

  it("non-US seller → no plate, even with a region that matches a painted state's code", async () => {
    const h = await renderSeller({ ...SELLER, country: "CA", region: "OR", location: "Somewhere" });
    expect(h).not.toMatch(/data-state-plate|<figure|artwork\/states/);
  });

  it("never infers a state from the location string or the name", async () => {
    const h = await renderSeller({ ...SELLER, name: "Oregon Grape Farm", region: null, location: "Junction City, Oregon" });
    expect(h).not.toMatch(/data-state-plate|artwork\/states/);
  });
});

describe("state page placement (§3)", () => {
  const card = (slug: string, region: string): SellerListItem => ({
    slug,
    name: "Willamette Test Farm",
    type: "specialty",
    location: null,
    region,
    country: "US",
    homepage: null,
    ratingCount: 0,
    ratingAverage: null,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    importedRating: null,
    isSmallFarm: false,
    varietyCount: 0,
  });

  it("renders its own state's plate, lazy, beside the intro inside <header>; the hero is untouched", async () => {
    const h = await renderState("oregon", [card("willamette-test-farm", "OR")]);
    const head = header(h);
    const fig = figureOf(head);
    expect(fig).not.toBeNull();
    expectPlate(fig!, "OR", "oregon", "lazy");
    expect(head).toContain('<div class="mt-6 min-w-0 sm:flex sm:items-start sm:gap-8"><div class="min-w-0 flex-1"><h1');
    // Order: hero → h1 → intro → CTA → plate; the farm grid follows the header, plate-free.
    const at = (s: string) => head.indexOf(s);
    expect(at('data-testid="state-hero"')).toBeLessThan(at("<h1"));
    expect(at("data-state-intro")).toBeLessThan(at('data-testid="state-add-farm"'));
    expect(at('data-testid="state-add-farm"')).toBeLessThan(at("data-state-plate"));
    const grid = h.slice(h.indexOf("</header>"));
    expect(grid).toContain('data-state-sellers="OR"');
    expect(grid).not.toMatch(/data-state-plate|artwork\/states/);
    expect(h.match(/data-state-plate=/g)).toHaveLength(1);
    // Lazy: React emits no preload for the plate, so it never competes with the hero's.
    expect(preloadsOf(h).filter((l) => l.includes("artwork/states/"))).toEqual([]);
    // Hero unchanged: scene asset at 1200, eager + high priority, .card, its own alt.
    const hero = /<img\b[^>]*data-state-hero-art="OR"[^>]*>/.exec(head)?.[0] ?? "";
    expect(attr(hero, "src")).toBe(T(1200, "theme/state-scenes/oregon.png"));
    expect(attr(hero, "loading")).toBe("eager");
    expect(attr(hero, "fetchPriority") ?? attr(hero, "fetchpriority")).toBe("high");
    expect(attr(hero, "class")).toMatch(/^card /);
    expect(decode(attr(hero, "alt") ?? "")).toBe(STATE_SCENES.oregon!.alt);
  });

  it("every painted state's page shows that state's plate", async () => {
    for (const slug of Object.keys(ADA_A2)) {
      const st = stateBySlug(slug)!;
      const fig = figureOf(header(await renderState(slug, [card("willamette-test-farm", st.code)])));
      expect(fig, slug).not.toBeNull();
      expectPlate(fig!, st.code, slug, "lazy");
    }
  });

  it("a state with sellers but no plate (Texas) renders the header as before: no figure, no substitute", async () => {
    const h = await renderState("texas", [card("lone-star-test-farm", "TX")]);
    expect(h).toContain("Seed farms in Texas");
    expect(h).not.toMatch(/data-state-plate|<figure|artwork\/states|<img/);
  });
});
