/**
 * Seller-listing artwork rail (2026-11-20): ListingArtwork resolves four tiers — the variety's
 * own first plate, the crop's first plate, the crop pod motif, the divider-stem placeholder —
 * with per-tier alt text, in the fixed 1:2 rail frame. ListingRow renders the rail in seller
 * context only (variety context has no artwork node at all), and the loading skeleton gains
 * the rail through its opt-in artwork variant (the default is untouched).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingArtwork } from "@/components/variety/ListingArtwork";
import { ListingRow } from "@/components/variety/ListingRow";
import { ListingSheetSkeleton } from "@/components/ui/Skeleton";
import type { Media, PublicListing } from "@/lib/validators";

const T = (width: number, key: string) =>
  `https://images.seeds.hues.flowers/cdn-cgi/image/width=${width},quality=80,format=auto,fit=scale-down/${key}`;
const media = (url: string): Media => ({ url, licence: "Own work", credit: "Illustration by Hues Floral Park" });
const attr = (tag: string, name: string) => new RegExp(`\\b${name}="([^"]*)"`).exec(tag)?.[1] ?? null;
const img = (h: string) => /<img\b[^>]*>/.exec(h)?.[0] ?? "";
const firstDivClass = (h: string) => /<div\b[^>]*class="([^"]*)"/.exec(h)?.[1] ?? "";

const PLATE_FRAME = "aspect-[1/2] w-18 shrink-0 self-start overflow-hidden rounded-inner border border-line bg-paper sm:w-24";
const GLYPH_FRAME =
  "flex aspect-[1/2] w-18 shrink-0 items-center justify-center self-start overflow-hidden rounded-inner border border-line bg-paper sm:w-24";

const art = (over: Partial<Parameters<typeof ListingArtwork>[0]> = {}): string =>
  renderToStaticMarkup(
    createElement(ListingArtwork, {
      media: [],
      cropMedia: [],
      varietyName: "Blue Vein",
      commonName: "Sweet Pea",
      plantSlug: "sweet-pea",
      ...over,
    }),
  );

const listing = (over: Partial<PublicListing> = {}): PublicListing => ({
  id: 42,
  variety: {
    slug: "sweet-pea-blue-vein",
    varietyName: "Blue Vein",
    plant: {
      slug: "sweet-pea",
      commonName: "Sweet Pea",
      latinName: "Lathyrus odoratus",
      season_class: null,
      season_source_label: null,
      sowing_methods: [],
      sowing_method_source_label: null,
    },
    colorSwatch: null,
    media: [],
    cropMedia: [],
  },
  seller: { slug: "songbird-seed-co", name: "Songbird Seed Co.", location: "Skagit Valley, WA", region: "WA", country: "US", isSmallFarm: false },
  availability: "in_stock",
  lastCheckedAt: "2026-11-19",
  firstSeenAt: "2026-10-20",
  goUrl: "https://seeds.hues.flowers/go/42",
  productUrl: null,
  notes: null,
  status: "published",
  packetSizes: [],
  provenance: { source_url: null, retrieved_at: null, method: "human", confidence: 1 },
  sourceLabel: null,
  ...over,
});

const card = (l: PublicListing, context: "variety" | "seller") => renderToStaticMarkup(createElement(ListingRow, { listing: l, context }));

describe("ListingArtwork — four tiers", () => {
  it("tier 1: the variety's own first plate, labelled with the variety name", () => {
    const h = art({ media: [media("/artwork/amaranth-mira.webp")], cropMedia: [media("/artwork/crops/zinnia.webp")] });
    expect(firstDivClass(h)).toBe(PLATE_FRAME);
    const tag = img(h);
    expect(attr(tag, "src")).toBe(T(480, "artwork/amaranth-mira-v2.png"));
    expect(attr(tag, "alt")).toBe("Blue Vein — illustration");
    expect(attr(tag, "width")).toBe("480");
    expect(attr(tag, "height")).toBe("960");
    expect(attr(tag, "loading")).toBe("lazy");
    expect(attr(tag, "decoding")).toBe("async");
    expect(attr(tag, "class")).toBe("block h-full w-full object-contain");
    expect(attr(tag, "srcSet") ?? attr(tag, "srcset")).toBeNull();
    expect(h).not.toContain("aria-hidden");
  });

  it("tier 2: the crop's first plate, labelled with the crop's common name", () => {
    const h = art({ cropMedia: [media("/artwork/crops/zinnia.webp")] });
    expect(firstDivClass(h)).toBe(PLATE_FRAME);
    const tag = img(h);
    expect(attr(tag, "src")).toBe(T(480, "artwork/crops/zinnia.webp"));
    expect(attr(tag, "alt")).toBe("Sweet Pea — illustration");
    expect(attr(tag, "class")).toBe("block h-full w-full object-contain");
    expect(h).not.toContain("aria-hidden");
  });

  it("tier 3: the crop pod motif, decorative, when neither has a plate", () => {
    const h = art();
    expect(firstDivClass(h)).toBe(GLYPH_FRAME);
    const tag = img(h);
    expect(tag).not.toBe("");
    expect(attr(tag, "src")).toContain("width=480,quality=80,format=auto,fit=scale-down/");
    expect(attr(tag, "src")).toContain("motif-sweet-pea");
    expect(attr(tag, "alt")).toBe("");
    expect(attr(tag, "aria-hidden")).toBe("true");
    expect(attr(tag, "width")).toBe("480");
    expect(attr(tag, "height")).toBe("480");
    expect(attr(tag, "class")).toBe("h-full w-full object-contain p-3 opacity-90 sm:p-4");
  });

  it("tier 4: the divider stem, decorative, when the crop has no pod art either", () => {
    const h = art({ plantSlug: "yarrow" });
    expect(firstDivClass(h)).toBe(GLYPH_FRAME);
    expect(h).not.toContain("<img");
    expect(h).toContain('<span aria-hidden="true" class="divider-stem w-full opacity-50"');
  });

  it("is never a link and carries no interaction styling, cover-fit or motion", () => {
    for (const h of [
      art({ media: [media("/artwork/amaranth-mira.webp")] }),
      art({ cropMedia: [media("/artwork/crops/zinnia.webp")] }),
      art(),
      art({ plantSlug: "yarrow" }),
    ]) {
      expect(h).not.toContain("<a");
      expect(h).not.toContain("hover:");
      expect(h).not.toContain("object-cover");
      expect(h).not.toContain("transition");
      expect(h).not.toContain("animation");
      expect(h).not.toContain("cursor-");
    }
  });
});

describe("ListingRow — seller-context-only artwork slot", () => {
  it("seller context: rail beside the text column, stem rule + footer full-width below", () => {
    const l = listing();
    l.variety.media = [media("/artwork/amaranth-mira.webp")];
    const h = card(l, "seller");
    // The grid + rail + text column.
    expect(h).toContain("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4");
    expect(h).toContain(PLATE_FRAME);
    expect(h).toContain('<div class="min-w-0">');
    // Art binds to the name: rail before the heading, both above the stem rule and footer.
    expect(h.indexOf(PLATE_FRAME)).toBeLessThan(h.indexOf(">Blue Vein</a>"));
    expect(h.indexOf(">Blue Vein</a>")).toBeLessThan(h.indexOf("listing-stem-rule"));
    expect(h.indexOf("listing-stem-rule")).toBeLessThan(h.indexOf("Report a problem"));
    expect(h.indexOf("Report a problem")).toBeLessThan(h.indexOf("Visit shop →"));
    // Text column classes byte-identical to the card's own: heading, subline, status.
    expect(h).toContain("font-display text-[20px] font-semibold leading-[1.2]");
    expect(h).toContain('<p class="mt-listing-subline text-base text-muted">Sweet Pea</p>');
    expect(h).toContain('mt-listing-status font-sans text-[13px] text-muted');
    // Equal-height row support: the seller-context article carries h-full.
    expect(h).toMatch(/<article[^>]*class="[^"]*h-full/);
  });

  it("sold-out seller card: full-fidelity artwork beside the working outline pill", () => {
    const l = listing({ availability: "sold_out" });
    l.variety.media = [media("/artwork/amaranth-mira.webp")];
    const h = card(l, "seller");
    expect(attr(img(h), "class")).toBe("block h-full w-full object-contain");
    expect(h).toContain("listing-card-soldout");
    expect(h).toContain('href="/go/42"');
    expect(h).toContain("bg-transparent");
    expect(h).not.toContain("disabled");
  });

  it("variety context renders no artwork node and no new wrapper", () => {
    const l = listing();
    l.variety.media = [media("/artwork/amaranth-mira.webp")];
    l.variety.cropMedia = [media("/artwork/crops/zinnia.webp")];
    const h = card(l, "variety");
    expect(h).not.toContain("<img");
    expect(h).not.toContain("w-18");
    expect(h).not.toContain("aspect-[1/2]");
    expect(h).not.toContain("grid-cols-");
    expect(h).not.toContain("min-w-0");
    expect(h).not.toMatch(/<article[^>]*h-full/);
  });
});

describe("ListingSheetSkeleton — opt-in artwork variant", () => {
  it("default: no rail, no grid (the variety shell is untouched)", () => {
    const h = renderToStaticMarkup(createElement(ListingSheetSkeleton, { rows: 2, className: "mt-3" }));
    expect(h).not.toContain("w-18");
    expect(h).not.toContain("aspect-[1/2]");
    expect(h).not.toContain("lg:grid");
    expect(h).not.toContain("h-full");
  });

  it("artwork: rail block beside the text bars, footer full-width below, lg 2-column list", () => {
    const h = renderToStaticMarkup(createElement(ListingSheetSkeleton, { rows: 2, className: "mt-3", artwork: true }));
    expect(h).toContain("flex flex-col gap-3 lg:grid lg:grid-cols-2 mt-3");
    expect(h).toContain("grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 sm:gap-4");
    expect(h).toContain("aspect-[1/2] w-18 rounded-inner sm:w-24");
    expect(h).toContain('<div class="min-w-0">');
    expect(h).toContain("<li class="); // h-full rows for the equal-height grid
    expect(h).toContain("h-full");
    expect(h.indexOf("aspect-[1/2]")).toBeLessThan(h.indexOf("justify-between"));
  });

  it("seller shell opts in; variety shell and the seller list take the ruled classes", () => {
    expect(readFileSync(join(process.cwd(), "app/seller/[slug]/skeleton.tsx"), "utf8")).toContain("<ListingSheetSkeleton rows={4} className=\"mt-3\" artwork />");
    expect(readFileSync(join(process.cwd(), "app/variety/[slug]/loading.tsx"), "utf8")).not.toContain("artwork");
    const seller = readFileSync(join(process.cwd(), "app/seller/[slug]/page.tsx"), "utf8");
    expect(seller).toContain('<ul className="mt-3 flex flex-col gap-3 lg:grid lg:grid-cols-2">');
    expect(seller).toContain('<li key={l.id} className="h-full">');
    expect(seller).not.toContain("min-h-");
    const card = readFileSync(join(process.cwd(), "components/variety/ListingRow.tsx"), "utf8");
    expect(card).not.toContain("mt-auto");
  });
});
