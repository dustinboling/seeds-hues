/**
 * Quiet Ledger listing card (Direction A, 2026-11-20): the calmed ListingRow — separate
 * surface card, seller name loudest, dot + words status with a friendly checked date (no
 * ISO anywhere), wheat-stem divider, "Report a problem" with a 44 px tap height, and the
 * 44 px "Visit shop →" pill whose full seller name survives only for screen readers.
 * Sold out keeps a working outline pill. The Small Farm badge is the shared SmallFarmBadge
 * component, rendered from the seller's real isSmallFarm flag (badge build, shipped).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ListingRow } from "@/components/variety/ListingRow";
import { formatCheckedDate } from "@/lib/format";
import type { PublicListing } from "@/lib/validators";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monD(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

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
  },
  seller: { slug: "songbird-seed-co", name: "Songbird Seed Co.", location: "Skagit Valley, WA", region: "WA", country: "US", isSmallFarm: false },
  availability: "in_stock",
  lastCheckedAt: isoDaysAgo(1),
  firstSeenAt: isoDaysAgo(30),
  goUrl: "https://seeds.hues.flowers/go/42",
  productUrl: null,
  notes: null,
  status: "published",
  packetSizes: [],
  provenance: { source_url: null, retrieved_at: null, method: "human", confidence: 1 },
  sourceLabel: null,
  ...over,
});

const html = (l: PublicListing, context: "variety" | "seller" = "variety") =>
  renderToStaticMarkup(createElement(ListingRow, { listing: l, context }));

const anchor = (h: string, hrefPart: string) =>
  h.match(new RegExp(`<a [^>]*href="${hrefPart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`))?.[0] ?? "";

describe("formatCheckedDate", () => {
  const now = new Date(2026, 10, 20, 12, 0, 0); // 20 Nov 2026, local

  it("renders today, yesterday and an absolute Mon D date", () => {
    expect(formatCheckedDate("2026-11-20", now)).toBe("today");
    expect(formatCheckedDate("2026-11-20T09:12:00Z", now)).toBe("today");
    expect(formatCheckedDate("2026-11-19", now)).toBe("yesterday");
    expect(formatCheckedDate("2026-11-02", now)).toBe("Nov 2");
    expect(formatCheckedDate("2026-01-05", now)).toBe("Jan 5");
  });

  it("returns null for a missing or unparseable value", () => {
    expect(formatCheckedDate(null, now)).toBeNull();
    expect(formatCheckedDate("unknown", now)).toBeNull();
    expect(formatCheckedDate("2026-13-40", now)).toBeNull();
  });
});

describe("ListingRow — Quiet Ledger card", () => {
  it("is a separate surface card: surface ground, warm border, radius and diffuse shadow", () => {
    const h = html(listing());
    expect(h).toContain("bg-surface");
    expect(h).toContain("border-[#e9dfc2]");
    expect(h).toContain("rounded-[18px]");
    expect(h).toContain("shadow-[0_6px_20px_rgba(151,134,95,0.14)]");
    expect(h).toContain("px-4");
    expect(h).toContain("pt-[18px]");
    expect(h).toContain("pb-3");
    expect(h).not.toContain("listing-card-soldout");
  });

  it("seller name is the loud heading (Fraunces 20 px, underlined) linking to the seller page", () => {
    const h = html(listing());
    const a = anchor(h, "/seller/songbird-seed-co");
    expect(a).toContain("text-ink");
    expect(a).toContain("underline");
    expect(a).toContain("decoration-ink-soft");
    expect(a).toContain("underline-offset-[3px]");
    expect(h).toContain("font-display");
    expect(h).toContain("text-[20px]");
    expect(h).toContain(">Songbird Seed Co.</a>");
    expect(h).toContain("Skagit Valley, WA");
  });

  it("shop pill: visible label is exactly 'Visit shop →', full seller name is sr-only", () => {
    const h = html(listing());
    expect(h).toContain('<span aria-hidden="true">Visit shop →</span>');
    expect(h).toContain('<span class="sr-only">Shop at Songbird Seed Co. (opens in a new tab)</span>');
    const a = anchor(h, "/go/42");
    expect(a).toContain('target="_blank"');
    expect(a).toContain('rel="nofollow noopener noreferrer"');
    // 44 px pill, sage-tint fill, load-bearing 1.5 px leaf border, leaf text.
    expect(a).toContain("h-11");
    expect(a).toContain("px-[18px]");
    expect(a).toContain("rounded-full");
    expect(a).toContain("bg-[#dfe9d6]");
    expect(a).toContain("border-[1.5px]");
    expect(a).toContain("border-leaf");
    expect(a).toContain("text-leaf");
    expect(a).toContain("text-[15px]");
    // The seller name is never repeated as the visible button label (only in the sr-only span).
    expect(h).not.toContain('<span aria-hidden="true">Shop at Songbird');
  });

  it("status line is dot + sentence-case words with a friendly date; no stock pill, no ISO date", () => {
    const h = html(listing({ lastCheckedAt: isoDaysAgo(0) }));
    expect(h).toContain("Checked today");
    expect(h).toContain("In stock");
    expect(h).toContain("bg-leaf-600");
    expect(h).toContain("text-leaf-600");
    expect(h).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(h).not.toContain("Last checked");
    expect(h).not.toContain("uppercase");
    expect(html(listing({ lastCheckedAt: isoDaysAgo(1) }))).toContain("Checked yesterday");
    expect(html(listing({ lastCheckedAt: isoDaysAgo(10) }))).toContain(`Checked ${monD(10)}`);
    expect(html(listing({ lastCheckedAt: null }))).toContain("Not yet checked");
    for (const rendered of [h, html(listing({ lastCheckedAt: isoDaysAgo(10) }))]) {
      expect(rendered).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });

  it("sold out: card steps down to paper, pill loses its fill but keeps a working /go/ link", () => {
    const h = html(listing({ availability: "sold_out", lastCheckedAt: isoDaysAgo(0) }));
    expect(h).toContain("listing-card-soldout");
    expect(h).toContain("bg-paper");
    expect(h).toContain("border-line");
    expect(h).toContain("shadow-[0_2px_8px_rgba(151,134,95,0.08)]");
    expect(h).toContain("Sold out");
    expect(h).toContain("bg-petal");
    expect(h).toContain("text-petal");
    const a = anchor(h, "/go/42");
    expect(a).not.toBe("");
    expect(a).toContain("bg-transparent");
    expect(a).toContain("shadow-none");
    expect(a).toContain("border-leaf");
    expect(a).not.toContain("disabled");
    expect(h).toContain("Visit shop →");
    expect(h).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("'Report a problem' is the shortened label with a 44 px tap height and the unchanged href", () => {
    const h = html(listing());
    const a = anchor(h, "/report?type=correct&amp;seller=songbird-seed-co&amp;variety=sweet-pea-blue-vein");
    expect(a).not.toBe("");
    expect(a).toContain("min-h-[44px]");
    expect(a).toContain("text-[13px]");
    expect(h).toContain(">Report a problem</a>");
    expect(h).not.toContain("Report a problem with this listing");
  });

  it("divides status from footer with the wheat-stem hairline", () => {
    const h = html(listing());
    expect(h).toContain('class="listing-stem-rule"');
    expect(h.indexOf("listing-stem-rule")).toBeGreaterThan(h.indexOf("Checked"));
    expect(h.indexOf("listing-stem-rule")).toBeLessThan(h.indexOf("Report a problem"));
  });

  it("keeps packet sizes and notes between the status line and the divider", () => {
    const h = html(listing({ packetSizes: [{ label: "Packet", seedCount: 25 }], notes: "Ships in spring." }));
    expect(h).toContain("Packets:");
    expect(h).toContain("Packet (25 seeds)");
    expect(h).toContain("Ships in spring.");
    expect(h.indexOf("Packets:")).toBeGreaterThan(h.indexOf("Checked"));
    expect(h.indexOf("Packets:")).toBeLessThan(h.indexOf("listing-stem-rule"));
  });

  describe("small-farm badge slot", () => {
    const badgedListing = (): PublicListing => {
      const badged = listing();
      badged.seller = { ...badged.seller, isSmallFarm: true };
      return badged;
    };

    it("renders the real SmallFarmBadge inline after the seller name when seller.isSmallFarm is true", () => {
      const h = html(badgedListing());
      // The shared component's own rendering: its data attribute (standard size), its
      // label, and its distinguishing classes (leaf/60 border, sage tint, tracked text).
      expect(h).toContain('data-small-farm-badge="standard"');
      expect(h).toContain("Small farm");
      expect(h).toContain("border-leaf/60");
      expect(h).toContain("bg-leaf-50");
      expect(h).toContain("tracking-[0.01em]");
      expect(h).not.toContain('data-testid="small-farm-badge"');
      expect(h.indexOf("Songbird Seed Co.")).toBeLessThan(h.indexOf("data-small-farm-badge"));
      expect(h.indexOf("data-small-farm-badge")).toBeLessThan(h.indexOf("Skagit Valley, WA"));
    });

    it("renders no badge when seller.isSmallFarm is false", () => {
      expect(html(listing())).not.toContain("data-small-farm-badge");
      expect(html(listing())).not.toContain("Small farm");
    });

    it("renders no badge in seller context even for a badged seller (the header carries it there)", () => {
      expect(html(badgedListing(), "seller")).not.toContain("data-small-farm-badge");
    });
  });

  it("seller context: variety is the heading, the same calmed card and shop treatment apply", () => {
    const h = html(listing(), "seller");
    expect(anchor(h, "/variety/sweet-pea-blue-vein")).not.toBe("");
    expect(h).toContain(">Blue Vein</a>");
    expect(h).toContain("Sweet Pea");
    expect(h).toContain("Visit shop →");
    expect(h).toContain('<span class="sr-only">Shop at Songbird Seed Co. (opens in a new tab)</span>');
    expect(h).not.toContain("data-small-farm-badge");
  });
});

describe("variety page — Quiet Ledger header block (source)", () => {
  // Since the badge build, the variety page's markup lives in variety-view.tsx (page.tsx is
  // the thin ISR route wrapper) — the header block is pinned where it actually renders.
  const page = readFileSync(join(process.cwd(), "app/variety/[slug]/variety-view.tsx"), "utf8");

  it("shows the summary line and the honesty line once, directly under the header", () => {
    const honesty = "Stock is as last seen when we checked each shop — it may have changed since. Prices are shown at the";
    expect(page.split(honesty)).toHaveLength(2); // exactly one occurrence
    expect(page).toContain("in stock");
    expect(page.indexOf(honesty)).toBeGreaterThan(page.indexOf('id="buy-title"'));
    expect(page.indexOf(honesty)).toBeLessThan(page.indexOf("<ListingRow"));
    // The old lower honesty wording is gone (relocated, not duplicated).
    expect(page).not.toContain("Stock is shown as last seen on the date checked");
  });

  it("stacks the cards with a 12 px gap and sorts in-stock above sold-out in the view", () => {
    expect(page).toContain("flex flex-col gap-3");
    expect(page).not.toContain("divide-y divide-line overflow-hidden rounded-[18px] border border-line bg-surface shadow-card");
    expect(page).toContain("sortedListings");
    expect(page).toContain('a === "in_stock" ? 0 : a === "sold_out" ? 2 : 1');
  });

  it("keeps the badge build's filter wiring: count-line live region, chips and legend", () => {
    expect(page).toContain('id="variety-listing-count"');
    expect(page).toContain("sf.countLine");
    expect(page).toContain("SellerFilterChips");
    expect(page).toContain("SmallFarmLegend");
    expect(page).toContain("sellerFilterView(v.listings, smallFarmOnly)");
  });
});

describe("variety page — sellers beside the painting layout (source)", () => {
  const page = readFileSync(join(process.cwd(), "app/variety/[slug]/variety-view.tsx"), "utf8");
  const GRID = "md:grid md:grid-cols-[380px_minmax(0,1fr)] md:items-start md:gap-8";

  it("reads header → About → painting → Where to buy → facts → sowing → report link → siblings", () => {
    const markers = [
      "</header>",
      'aria-labelledby="about-title"',
      "<VarietyHeroImage",
      'aria-labelledby="buy-title"',
      'aria-labelledby="facts-title"',
      'aria-labelledby="sowing-title"',
      "Report a problem",
      'aria-labelledby="more-title"',
    ];
    const positions = markers.map((m) => page.indexOf(m));
    let prev = -1;
    for (const [i, pos] of positions.entries()) {
      expect(pos, markers[i]).toBeGreaterThan(prev);
      prev = pos;
    }
    // Heading outline stays logical: h1 → About (h2) → Where to buy (h2) → facts → sowing.
    const headings = [
      '<h1 id="variety-title"',
      '<h2 id="about-title"',
      '<h2 id="buy-title"',
      '<h2 id="facts-title"',
      '<h2 id="sowing-title"',
    ];
    const hpos = headings.map((m) => page.indexOf(m));
    let hprev = -1;
    for (const pos of hpos) {
      expect(pos).toBeGreaterThan(hprev);
      hprev = pos;
    }
  });

  it("About sits directly beneath the header, full width above the painting/sellers block", () => {
    const afterHeader = page.slice(
      page.indexOf("</header>") + "</header>".length,
      page.indexOf('<section aria-labelledby="about-title"'),
    );
    expect(afterHeader.trim()).toBe("");
    // The whole About block (both paragraphs and the written-description conditional) moved
    // with the section, ahead of the grid wrapper — not inside either column.
    expect(page.indexOf("Directory summary:")).toBeGreaterThan(page.indexOf('aria-labelledby="about-title"'));
    expect(page.indexOf("Directory summary:")).toBeLessThan(page.indexOf(GRID));
    expect(page).toContain("About {label}");
    // The crop-level guidance box is a different block — it stays in Sowing and growing.
    expect(page.indexOf("Crop-level guidance for")).toBeGreaterThan(page.indexOf('aria-labelledby="sowing-title"'));
  });

  it("wraps hero and buy section in an md-only two-column grid, only when a hero image exists", () => {
    // Exactly one grid wrapper, conditional on the hero image: no image means a plain block
    // (className undefined), so there is never an empty left column.
    expect(page.split(GRID)).toHaveLength(2);
    const wrapper = page.match(/<div className=\{v\.media\[0\] \? "([^"]+)" : undefined\}>/)?.[1] ?? "";
    expect(wrapper.split(" ")).toEqual([
      "md:grid",
      "md:grid-cols-[380px_minmax(0,1fr)]",
      "md:items-start",
      "md:gap-8",
    ]);
    // Both children keep mt-6: aligned tops in the grid, today's stacked rhythm below md.
    expect(page).toContain('<section aria-labelledby="buy-title" className="mt-6">');
    const hero = readFileSync(join(process.cwd(), "components/variety/VarietyHeroImage.tsx"), "utf8");
    expect(hero).toContain('<figure className="mt-6"');
    // Facts and everything after stay full width below the two-column block.
    expect(page.indexOf('aria-labelledby="facts-title"')).toBeGreaterThan(page.indexOf("</div>", page.indexOf(GRID)));
  });

  it("puts the entire buy section — including the zero-seller state — inside the wrapper", () => {
    // The slice ends at the START of the facts section's opening tag, so the counted region
    // covers exactly the wrapper's contents (ending at the aria-labelledby attribute would
    // include the facts tag's own <section).
    const between = page.slice(page.indexOf(GRID), page.indexOf('<section aria-labelledby="facts-title"'));
    expect(between).toContain("<VarietyHeroImage");
    expect(between).toContain('aria-labelledby="buy-title"');
    expect(between.match(/<section/g)).toHaveLength(1);
    // Zero sellers renders in the right column, where the listings would have gone.
    expect(between).toContain("No sellers yet");
    expect(between).toContain("WaitlistBlock");
    // The listing machinery stays inside the moved section, untouched.
    for (const marker of ["SellerFilterChips", "variety-listing-count", "SmallFarmLegend", "<ListingRow", "ResultsScrollClamp"]) {
      expect(between, marker).toContain(marker);
    }
  });
});
