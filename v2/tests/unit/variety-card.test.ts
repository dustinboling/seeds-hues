/**
 * The unified variety card (SPEC-GRID-CARD §§3–4): one component, two contexts. Latin
 * presence (verbatim) and absence (no node at all), the tier order, zero stem elements
 * in any card state, the browse zone's floor-not-ceiling geometry, shop-context anatomy
 * (h3 link, stock line, pinned footer), and the transferred sold-out dress.
 *
 * Non-vacuity (T-A): fails on pre-build code — the shop context, the Latin line, the
 * grown zone, and the tier-2/3/4 frame do not exist there.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ShopCardSkeleton, VarietyCardSkeleton, VarietyGridSkeleton } from "@/components/ui/Skeleton";
import { ShopVarietyGrid, VarietyCard, VarietyGrid } from "@/components/variety/VarietyCard";
import type { Media, PublicListing, VarietyListItem } from "@/lib/validators";

const media = (url: string): Media => ({ url, licence: "Own work", credit: "Illustration by Hues Floral Park" });

function item(over: Omit<Partial<VarietyListItem>, "plant"> & { plant?: Partial<VarietyListItem["plant"]> } = {}): VarietyListItem {
  const { plant, ...rest } = over;
  return {
    slug: "zinnia-benary-giant",
    varietyName: "Benary Giant",
    plant: {
      slug: "zinnia",
      commonName: "Zinnia",
      latinName: "Zinnia elegans",
      lifeCycle: "Annual",
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
      ...plant,
    },
    category: { slug: "flowers", name: "Flowers" },
    subcategory: null,
    series: null,
    colorSwatch: null,
    colorFamily: "pink",
    listingCount: 1,
    sellerCount: 1,
    inStockCount: 1,
    lastCheckedAt: "2026-11-15",
    indexable: true,
    rating: { state: "not_yet_rated", average: null, review_count: 0 },
    media: [],
    cropMedia: [],
    ...rest,
  };
}

function shopListing(over: Partial<PublicListing> = {}): PublicListing {
  return {
    id: 42,
    variety: {
      slug: "sweet-pea-blue-vein",
      varietyName: "Blue Vein",
      plant: {
        slug: "sweet-pea",
        commonName: "Sweet Pea",
        latinName: "Lathyrus odoratus",
        lifeCycle: "Hardy annual",
        season_class: null,
        season_source_label: null,
        sowing_methods: [],
        sowing_method_source_label: null,
      },
      colorSwatch: null,
      colorFamily: "blue",
      media: [],
      cropMedia: [],
    },
    seller: { slug: "songbird-seed-co", name: "Songbird Seed Co.", location: null, region: "WA", country: "US", isSmallFarm: false },
    availability: "in_stock",
    lastCheckedAt: "2026-01-15",
    firstSeenAt: "2025-01-01",
    goUrl: "https://seeds.hues.flowers/go/42",
    productUrl: null,
    notes: null,
    status: "published",
    packetSizes: [],
    provenance: { source_url: null, retrieved_at: "2026-01-15", method: "human", confidence: 1 },
    sourceLabel: "Shop check",
    ...over,
  };
}

const browseHtml = (v: VarietyListItem) => renderToStaticMarkup(createElement(VarietyCard, { v }));
const shopHtml = (l: PublicListing) => renderToStaticMarkup(createElement(VarietyCard, { listing: l, context: "shop" }));
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const firstImg = (h: string) => /<img\b[^>]*>/.exec(h)?.[0] ?? "";

describe("Latin line (G-3)", () => {
  it("renders the payload's latinName verbatim and whole, in Thea's exact dress", () => {
    const h = browseHtml(item());
    expect(h).toContain('<span class="text-sm text-muted"><i class="normal-case tracking-normal">Zinnia elegans</i></span>');
    const multi = browseHtml(item({ plant: { latinName: "Asclepias tuberosa / A. incarnata / A. physocarpa" } }));
    expect(multi).toContain(">Asclepias tuberosa / A. incarnata / A. physocarpa</i>");
    const hybrid = browseHtml(item({ plant: { latinName: "Dahlia × hybrida" } }));
    expect(hybrid).toContain(">Dahlia × hybrida</i>");
    const letterX = browseHtml(item({ plant: { latinName: "Aquilegia x hybrida / A. vulgaris" } }));
    expect(letterX).toContain(">Aquilegia x hybrida / A. vulgaris</i>"); // never normalized to ×
    // Same line, same dress, in shop context.
    expect(shopHtml(shopListing())).toContain('<span class="text-sm text-muted"><i class="normal-case tracking-normal">Lathyrus odoratus</i></span>');
  });

  it("null latinName renders no node at all — no placeholder, no empty element, no reserved slot", () => {
    for (const h of [browseHtml(item({ plant: { latinName: null } })), shopHtml(shopListing({ variety: { ...shopListing().variety, plant: { ...shopListing().variety.plant, latinName: null } } }))]) {
      expect(h).not.toMatch(/<i[\s>]/); // no italic element at all (<img> is the frame, not the line)
      expect(h).not.toContain("Latin");
      expect(h).not.toContain("unknown");
    }
  });

  it("sits first in the text zone, directly under the frame, above the name", () => {
    const h = browseHtml(item());
    const frame = h.indexOf("aspect-[1/2]");
    const latin = h.indexOf("Zinnia elegans");
    const name = h.indexOf("Benary Giant</span>");
    expect(frame).toBeGreaterThanOrEqual(0);
    expect(latin).toBeGreaterThan(frame);
    expect(name).toBeGreaterThan(latin);
  });
});

describe("art frame tiers (Elena's order, both contexts)", () => {
  const plate = media("/artwork/zinnia-benary.webp");
  const cropPlate = media("/artwork/crops/zinnia.webp");

  it("tier 1: the variety's own plate, variety alt, paper ground", () => {
    const h = browseHtml(item({ media: [plate], cropMedia: [cropPlate] }));
    const tag = firstImg(h);
    expect(attr(tag, "alt")).toBe("Benary Giant — illustration");
    expect(h).toContain('data-testid="variety-card-image"');
    expect(h).toContain("bg-paper\"");
    expect(h).not.toContain("bg-paper-deep");
  });

  it("tier 2: the crop's plate with the crop-name alt (full common name)", () => {
    const h = browseHtml(item({ media: [], cropMedia: [cropPlate], plant: { commonName: "Cornflower / Bachelor's Buttons" } }));
    expect(attr(firstImg(h), "alt")).toBe("Cornflower / Bachelor&#x27;s Buttons — illustration");
    expect(h).toContain('data-testid="variety-card-image"');
    // Tier 2 also reaches the shop grid (it was already there via the retired rail).
    const s = shopHtml(shopListing({ variety: { ...shopListing().variety, media: [], cropMedia: [cropPlate] } }));
    expect(attr(firstImg(s), "alt")).toBe("Sweet Pea — illustration");
  });

  it("tier 3: the crop's pod device, decorative, on paper-deep", () => {
    const h = browseHtml(item({ media: [], cropMedia: [], plant: { slug: "zinnia" } }));
    const tag = firstImg(h);
    expect(tag).toContain("motif-zinnia.");
    expect(attr(tag, "alt")).toBe("");
    expect(tag).toContain('aria-hidden="true"');
    expect(h).toContain('data-testid="variety-card-placeholder"');
    expect(h).toContain("bg-paper-deep");
  });

  it("tier 4: the generic pod device, decorative, on paper-deep — never the stem, never another crop's pod", () => {
    const h = browseHtml(item({ media: [], cropMedia: [], plant: { slug: "dahlia", commonName: "Dahlia" } }));
    const tag = firstImg(h);
    expect(tag).toContain("motif-poppy.");
    expect(tag).not.toContain("motif-zinnia");
    expect(attr(tag, "alt")).toBe("");
    expect(tag).toContain('aria-hidden="true"');
    expect(h).toContain("bg-paper-deep");
    expect(h).not.toContain("divider-stem");
  });

  it("the frame is full card width, 1:2, whole plate — and the img is the only forced-color specimen", () => {
    const h = browseHtml(item({ media: [plate] }));
    expect(h).toContain("aspect-[1/2]");
    expect(h).toContain("object-contain");
    expect(h).not.toMatch(/object-cover/);
    expect(firstImg(h)).toContain("forced-color-adjust:none");
    // The exemption appears on the img only — never on the card, frame, or text.
    expect(h.match(/forced-color-adjust/g) ?? []).toHaveLength(1);
  });
});

describe("motif out (G-2)", () => {
  it("zero stem elements in any card state — plated, placeholder, filtered, searched, skeleton", () => {
    const states = [
      browseHtml(item({ media: [media("/artwork/zinnia-benary.webp")] })),
      browseHtml(item({ media: [], cropMedia: [] })),
      shopHtml(shopListing()),
      shopHtml(shopListing({ availability: "sold_out" })),
      renderToStaticMarkup(createElement(VarietyCardSkeleton)),
      renderToStaticMarkup(createElement(ShopCardSkeleton)),
      renderToStaticMarkup(createElement(VarietyGridSkeleton, { count: 4, context: "shop" })),
    ];
    for (const h of states) {
      expect(h).not.toContain("divider-stem-mini");
      expect(h).not.toContain("divider-stem");
      expect(h).not.toContain("stem-rule");
    }
  });
});

describe("browse context", () => {
  it("is one whole-card link with the short-crop aria-label, no per-card heading, card-hover kept", () => {
    const h = browseHtml(item({ plant: { commonName: "Cornflower / Bachelor's Buttons" } }));
    expect(h).toMatch(/^<a\b[^>]*href="\/variety\/zinnia-benary-giant"[^>]*>/);
    expect(h).toContain('aria-label="Benary Giant — Cornflower"');
    expect(h).not.toContain("<h3");
    expect(h).toContain("card-hover");
    // The visible crop line shows the same short form the label names.
    expect(h).toContain('<span class="text-sm text-muted">Cornflower</span>');
  });

  it("text zone is min-height 9.75rem — never a literal height, no overflow clipping on zone or card", () => {
    const h = browseHtml(item());
    expect(h).toContain("min-h-[9.75rem]");
    expect(h).not.toContain("h-[6.25rem]");
    expect(h).not.toMatch(/[\s"]h-\[9\.75rem\]/); // no literal height (min-h- excluded by the lookbehind class)
    // The frame mount keeps its shipped overflow-hidden; the zone and card carry none.
    expect(h.match(/overflow-hidden/g) ?? []).toHaveLength(1);
  });

  it("seller-count line verbatim: none / one / many", () => {
    expect(browseHtml(item({ sellerCount: 0 }))).toContain(">No sellers yet</span>");
    expect(browseHtml(item({ sellerCount: 1 }))).toContain(">1 seller</span>");
    expect(browseHtml(item({ sellerCount: 12 }))).toContain(">12 sellers</span>");
  });
});

describe("shop context", () => {
  it("is NOT a whole-card link and carries no card-hover; the h3 name link is block with a 44px minimum", () => {
    const h = shopHtml(shopListing());
    expect(h).toMatch(/^<div\b/);
    expect(h).not.toContain("card-hover");
    const m = /<h3\b[^>]*>([\s\S]*)<\/h3>/.exec(h);
    expect(m).not.toBeNull();
    expect(m![0]).toContain('href="/variety/sweet-pea-blue-vein"');
    expect(m![0]).toContain("block min-h-target");
    expect(m![0]).toContain('<span class="line-clamp-2">Blue Vein</span>');
    // Exactly one h3 per card, containing exactly the variety name.
    expect(h.match(/<h3\b/g) ?? []).toHaveLength(1);
  });

  it("stock line in the ledger's exact dress: dot + word + checked date, or Not yet checked", () => {
    const h = shopHtml(shopListing());
    expect(h).toContain("mt-listing-status font-sans text-[13px] text-muted");
    expect(h).toContain('aria-hidden="true"');
    expect(h).toContain('<span class="font-semibold text-leaf">In stock</span>');
    expect(h).toContain("· Checked Jan 15");
    const unchecked = shopHtml(shopListing({ lastCheckedAt: null, availability: "unknown" }));
    expect(unchecked).toContain('<span class="font-semibold text-warn">Unknown</span>');
    expect(unchecked).toContain("· Not yet checked");
    expect(shopListing().lastCheckedAt).not.toBeNull(); // the null above is the test's, not the fixture's
  });

  it("packets + notes render where present and nowhere else", () => {
    const full = shopHtml(shopListing({ packetSizes: [{ label: "Packet", seedCount: 25 }], notes: "Sow after frost." }));
    expect(full).toContain("Packets: ");
    expect(full).toContain("Packet (25 seeds)");
    expect(full).toContain("Sow after frost.");
    const bare = shopHtml(shopListing());
    expect(bare).not.toContain("Packets:");
  });

  it("pinned footer: Report left with the ledger URL, working Visit shop pill right, no stem rule", () => {
    const h = shopHtml(shopListing());
    expect(h).toContain("mt-auto flex w-full items-center justify-between gap-3 pt-4");
    expect(h).toContain('href="/report?type=correct&amp;seller=songbird-seed-co&amp;variety=sweet-pea-blue-vein"');
    expect(h).toContain(">Report a problem</a>");
    expect(h).toContain('href="/go/42"');
    expect(h).toContain('rel="nofollow noopener noreferrer"');
    expect(h).toContain('target="_blank"');
    expect(h).toContain('<span aria-hidden="true">Visit shop →</span>');
    expect(h).toContain('<span class="sr-only">Shop at Songbird Seed Co. (opens in a new tab)</span>');
    expect(h).not.toContain("stem-rule");
    // Focus order is DOM order: name link → Report → pill.
    const name = h.indexOf("/variety/sweet-pea-blue-vein");
    const report = h.indexOf("/report?");
    const pill = h.indexOf("/go/42");
    expect(name).toBeLessThan(report);
    expect(report).toBeLessThan(pill);
  });

  it("sold-out dress: stepped ground + softened shadow, outline-only WORKING pill, full-fidelity plate", () => {
    const plated = { ...shopListing().variety, media: [media("/artwork/sweet-pea-blue-vein.webp")] };
    const h = shopHtml(shopListing({ availability: "sold_out", variety: plated }));
    expect(h).toContain("bg-paper shadow-listing-flat");
    expect(h).toContain("bg-transparent shadow-none");
    expect(h).toContain('href="/go/42"'); // the pill keeps working
    expect(h).toContain('<span class="font-semibold text-petal">Sold out</span>');
    const tag = firstImg(h);
    expect(tag).not.toMatch(/opacity-|grayscale|blur|brightness-|contrast-|saturate-|sepia|invert|hue-rotate/);
    const available = shopHtml(shopListing());
    expect(available).not.toContain("bg-paper shadow-listing-flat");
    expect(available).toContain("bg-visit shadow-visit-pill");
  });
});

describe("grids + skeletons", () => {
  it("VarietyGrid keeps its shipped variants; the shop grid is the standard variant over listings", () => {
    const wide = renderToStaticMarkup(createElement(VarietyGrid, { items: [item()], wide: true }));
    expect(wide).toContain("grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5");
    const shop = renderToStaticMarkup(createElement(ShopVarietyGrid, { listings: [shopListing()] }));
    expect(shop).toContain("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4");
    expect(shop).toContain("/variety/sweet-pea-blue-vein");
  });

  it("VarietyCardSkeleton: mini-stem bar out, Latin bar in first, zone at the floor value", () => {
    const h = renderToStaticMarkup(createElement(VarietyCardSkeleton));
    expect(h).not.toContain("stem");
    expect(h).not.toContain("mt-1 h-3 w-10");
    expect(h).toContain("min-h-[9.75rem]");
    const bars = [...h.matchAll(/class="skeleton ([^"]*)"/g)].map((m) => m[1]);
    expect(bars[1]).toBe("h-5 w-3/5"); // the Latin bar, first in the zone
  });

  it("shop card skeleton: frame → Latin → name → crop → stock → packets → footer row, no rule bar", () => {
    const h = renderToStaticMarkup(createElement(ShopCardSkeleton));
    const bars = [...h.matchAll(/class="skeleton ([^"]*)"/g)].map((m) => m[1]);
    expect(bars).toEqual([
      "card-image mb-2 aspect-[1/2] w-full rounded-inner",
      "h-5 w-3/5",
      "h-5 w-4/5",
      "h-4 w-1/2",
      "h-4 w-3/5",
      "h-4 w-2/3",
      "h-4 w-24",
      "h-11 w-32 shrink-0 rounded-full",
    ]);
    expect(h).toContain("mt-4 flex w-full items-center justify-between");
    expect(h).not.toContain("stem-rule");
    expect(h).not.toContain("border-t");
  });

  it("the shop grid skeleton renders the page shell's stand-in count", () => {
    const h = renderToStaticMarkup(createElement(VarietyGridSkeleton, { count: 4, context: "shop" }));
    expect(h.match(/<li\b/g) ?? []).toHaveLength(4);
    expect(h).toContain("grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4");
  });
});
