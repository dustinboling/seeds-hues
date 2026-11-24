/**
 * Slice 3 component ports, server-rendered (renderToStaticMarkup needs no
 * DOM): every branch the HTTP suite does not isolate — listing-card states,
 * filter chips/counts/empty states, the waitlist floor's exact fields, card
 * image tiers, badges. Copy expectations are v2-verbatim, hardcoded.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RatingDisplay } from "../../src/components/RatingDisplay";
import { SmallFarmBadge, SmallFarmLegend } from "../../src/components/seller/SmallFarmBadge";
import { ListingRow } from "../../src/components/variety/ListingRow";
import { PacketList } from "../../src/components/variety/PacketList";
import { ProtectionBadge, showsProtection } from "../../src/components/variety/ProtectionBadge";
import { ResultsScrollClamp } from "../../src/components/variety/ResultsScrollClamp";
import { SellerFilterSection } from "../../src/components/variety/SellerFilterSection";
import { VarietyCard, VarietyGrid } from "../../src/components/variety/VarietyCard";
import { VarietyCardImage } from "../../src/components/variety/VarietyCardImage";
import { VarietyHeroImage } from "../../src/components/variety/VarietyHeroImage";
import { ViewBeacon } from "../../src/components/variety/ViewBeacon";
import { WaitlistBlock } from "../../src/components/variety/WaitlistBlock";
import { fakeCatalogState } from "./fake-catalog";

const decode = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const state = () => fakeCatalogState();
const kingsRansom = () => state().details["sweet-pea-kings-ransom"]!;
const candyStripe = () => state().details["cosmos-candy-stripe"]!;
const lonelyBloom = () => state().details["cosmos-lonely-bloom"]!;

describe("ListingRow", () => {
  it("renders the full in-stock card: badge, location, stock line, packets, note, footer links", () => {
    const html = renderToStaticMarkup(ListingRow({ listing: kingsRansom().listings[0]! }));
    const text = decode(html);
    expect(html).toContain('data-availability="in_stock"');
    expect(html).toContain('href="/seller/blue-ridge-seeds"');
    expect(text).toContain("Blue Ridge Seeds");
    expect(text).toContain("Small farm");
    expect(text).toContain("Portland, OR");
    expect(text).toContain("In stock");
    expect(text).toContain("Checked Nov 20");
    expect(text).toContain("Packets:");
    expect(text).toContain("25 seeds · 1 g (90 seeds)");
    expect(text).toContain("Packet sizes vary by season.");
    expect(html).toContain('href="/report?type=correct&amp;seller=blue-ridge-seeds&amp;variety=sweet-pea-kings-ransom"');
    expect(text).toContain("Report a problem");
    expect(html).toContain('href="/go/1"');
    expect(html).toContain('rel="nofollow noopener noreferrer"');
    expect(html).toContain('target="_blank"');
    expect(text).toContain("Visit shop →");
    expect(text).toContain("Shop at Blue Ridge Seeds (opens in a new tab)");
  });

  it("renders the sold-out card without badge or note", () => {
    const html = renderToStaticMarkup(ListingRow({ listing: kingsRansom().listings[1]! }));
    const text = decode(html);
    expect(html).toContain('data-availability="sold_out"');
    expect(text).toContain("Sold out");
    expect(text).toContain("Checked Nov 18");
    expect(text).not.toContain("Small farm");
    expect(text).toContain("50 seeds");
    expect(html).toContain('href="/go/2"');
  });

  it("renders unchecked listings with notes but no packets", () => {
    const html = renderToStaticMarkup(ListingRow({ listing: kingsRansom().listings[2]! }));
    const text = decode(html);
    expect(text).toContain("Preorder");
    expect(text).toContain("Not yet checked");
    expect(text).toContain("Treated seed.");
    expect(text).not.toContain("Packets:");
  });
});

describe("PacketList", () => {
  it("renders labels with seed counts, never duplicating the count", () => {
    const html = decode(
      renderToStaticMarkup(
        PacketList({
          packets: [
            { label: "25 seeds", seedCount: 25 },
            { label: "1 g", seedCount: 90 },
            { label: "Packet of 10", seedCount: 10 },
          ],
        }),
      ),
    );
    expect(html).toContain("Packets:");
    expect(html).toContain("25 seeds · 1 g (90 seeds) · Packet of 10");
  });

  it("renders nothing without packets", () => {
    expect(renderToStaticMarkup(PacketList({ packets: [] }))).toBe("");
  });
});

describe("SellerFilterSection (server render: real links, server-correct state)", () => {
  it("renders chips as links with aria-current on All sellers + in-stock-first order", () => {
    const detail = kingsRansom();
    const html = renderToStaticMarkup(
      <SellerFilterSection slug={detail.slug} varietyName={detail.varietyName} listings={detail.listings} initialSmallFarmOnly={false} />,
    );
    const text = decode(html);
    expect(html).toContain('data-testid="variety-seller-filter"');
    expect(html).toContain('<a href="/variety/sweet-pea-kings-ransom"');
    expect(html).toContain('<a href="/variety/sweet-pea-kings-ransom?small_farm=true"');
    expect(html).toMatch(/aria-current="true"[^>]*>\s*All sellers/s);
    expect(text).toContain("3 listings.");
    expect(text).toContain("The Small farm badge marks a seller we judge to be a small family farm");
    // Quiet Ledger SSR sort: in-stock first, sold-out last, stable.
    const positions = ["/go/1", "/go/3", "/go/2"].map((href) => html.indexOf(`href="${href}"`));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("narrows to badged sellers on the variant, with the 'of N' count line", () => {
    const detail = kingsRansom();
    const html = renderToStaticMarkup(
      <SellerFilterSection slug={detail.slug} varietyName={detail.varietyName} listings={detail.listings} initialSmallFarmOnly={true} />,
    );
    const text = decode(html);
    expect(html).toMatch(/aria-current="true"[^>]*>\s*Small farms only/s);
    expect(text).toContain("2 of 3 listings · Small farms only.");
    expect(text).toContain("Blue Ridge Seeds");
    expect(text).not.toContain("Prairie Seed House");
    expect(html.match(/href="\/go\/\d+"/g)).toHaveLength(2);
  });

  it("renders no chips where no seller is badged (but the full list)", () => {
    const detail = candyStripe();
    const html = renderToStaticMarkup(
      <SellerFilterSection slug={detail.slug} varietyName={detail.varietyName} listings={detail.listings} initialSmallFarmOnly={false} />,
    );
    const text = decode(html);
    expect(html).not.toContain('data-testid="variety-seller-filter"');
    expect(text).toContain("2 listings.");
    expect(text).not.toContain("The Small farm badge marks");
    expect(html.match(/href="\/go\/\d+"/g)).toHaveLength(2);
  });

  it("renders the small-farm empty state with a server link back to all sellers", () => {
    const detail = candyStripe();
    const html = renderToStaticMarkup(
      <SellerFilterSection slug={detail.slug} varietyName={detail.varietyName} listings={detail.listings} initialSmallFarmOnly={true} />,
    );
    const text = decode(html);
    expect(html).toContain('data-testid="variety-small-farm-empty"');
    expect(text).toContain("No seller with the Small farm badge lists Candy Stripe yet.");
    expect(text).toContain("Show all sellers");
    expect(html).toContain('<a href="/variety/cosmos-candy-stripe"');
    expect(html).not.toContain("/go/");
  });
});

describe("WaitlistBlock (no-JS floor, server-rendered)", () => {
  it("renders the pre-join form with exactly v2's fields and behavior", () => {
    const detail = lonelyBloom();
    const html = renderToStaticMarkup(<WaitlistBlock varietySlug={detail.slug} varietyName={detail.varietyName} />);
    const text = decode(html);
    expect(html).toContain('id="waitlist-block"');
    expect(html).toContain('data-testid="waitlist-block"');
    expect(text).toContain("Join the waiting list — we’ll let you know when a seller lists Lonely Bloom.");
    expect(text).toContain("You can also choose a text alert. One alert when it’s first found; leave the list any time.");
    expect(html).toContain("<form");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/api/v1/account/waitlist/join-form"');
    expect(html).toContain('aria-label="Join the waiting list for Lonely Bloom"');
    expect(text).toContain("Joining creates a free Seed Directory account.");
    expect(html).toContain('name="variety"');
    expect(html).toContain('value="cosmos-lonely-bloom"');
    expect(html).toContain('id="waitlist-floor-email"');
    expect(html).toContain('name="email"');
    expect(html).toContain('type="email"');
    expect(html).toContain("How should we tell you?");
    expect(html).toContain('name="channel"');
    expect(html).toContain('value="email"');
    expect(html).toContain('value="sms"');
    expect(text).toContain("Email only");
    expect(text).toContain("Email and text");
    expect(text).toContain(
      "We’ll text the phone number below (after a one-time code to confirm it). Message frequency varies (one text per variety when it’s found). Msg & data rates may apply. Reply STOP to end, HELP for help. Consent is not a condition of purchase.",
    );
    expect(text).toContain("Phone number (only needed for text alerts)");
    expect(text).toContain("US number. Your email + phone are how you sign in — there’s no password. We never show your phone number.");
    // The floor phone field is visible and never `required`.
    const phone = html.match(/<input[^>]*id="waitlist-floor-phone"[^>]*>/)?.[0] ?? "";
    expect(phone.length).toBeGreaterThan(0);
    expect(phone).not.toContain("required");
    expect(text).toContain("Join the waiting list");
    expect(html).toContain('type="submit"');
  });
});

describe("card + hero images", () => {
  const siblings = () => state().listItems;

  it("tiers the card art: variety plate, crop plate, pod motif, generic device", () => {
    const [blueRibbon, roseQueen, , , whiteNight] = siblings();
    const tier1 = renderToStaticMarkup(
      VarietyCardImage({ media: blueRibbon!.media, cropMedia: [], varietyName: "Blue Ribbon", cropName: "Sweet Pea", plantSlug: "sweet-pea" }),
    );
    expect(tier1).toContain('data-testid="variety-card-image"');
    expect(decode(tier1)).toContain('alt="Blue Ribbon — illustration"');
    expect(tier1).toContain("images.seeds.hues.flowers");
    expect(tier1).toMatch(/srcset/i);
    const tier2 = renderToStaticMarkup(
      VarietyCardImage({ media: [], cropMedia: roseQueen!.cropMedia, varietyName: "Rose Queen", cropName: "Sweet Pea", plantSlug: "sweet-pea" }),
    );
    expect(decode(tier2)).toContain('alt="Sweet Pea — illustration"');
    expect(tier2).not.toMatch(/srcset/i);
    const tier3 = renderToStaticMarkup(
      VarietyCardImage({ media: [], cropMedia: whiteNight!.cropMedia, varietyName: "White Night", cropName: "Cosmos", plantSlug: "cosmos" }),
    );
    expect(tier3).toContain('data-testid="variety-card-placeholder"');
    expect(tier3).toContain("motif-cosmos");
    expect(tier3).toContain('alt=""');
    const tier4 = renderToStaticMarkup(
      VarietyCardImage({ media: [], cropMedia: [], varietyName: "X", cropName: "Eucalyptus", plantSlug: "eucalyptus" }),
    );
    expect(tier4).toContain("motif-poppy");
  });

  it("renders the hero plate whole with fixed dimensions", () => {
    const html = renderToStaticMarkup(
      VarietyHeroImage({ media: kingsRansom().media[0]!, label: "King's Ransom Sweet Pea" }),
    );
    expect(html).toContain('data-testid="variety-hero"');
    expect(decode(html)).toContain('alt="King\'s Ransom Sweet Pea — illustration"');
    expect(html).toContain('width="1120"');
    expect(html).toContain('height="2240"');
    expect(html).toContain("images.seeds.hues.flowers");
    expect(html).toContain('loading="eager"');
  });
});

describe("badges + facts atoms", () => {
  it("renders the Small farm badge and legend", () => {
    expect(decode(renderToStaticMarkup(SmallFarmBadge({})))).toContain("Small farm");
    expect(renderToStaticMarkup(SmallFarmBadge({ size: "large" }))).toContain('data-small-farm-badge="large"');
    const legend = decode(renderToStaticMarkup(SmallFarmLegend({})));
    expect(legend).toContain("Small farm");
    expect(legend).toContain("The Small farm badge marks a seller we judge to be a small family farm");
  });

  it("renders the rating state and protection claims", () => {
    expect(decode(renderToStaticMarkup(RatingDisplay({ ratingCount: 0 })))).toContain("Not yet rated");
    expect(showsProtection("pvp_us", "Claim text.")).toBe(true);
    expect(showsProtection("unknown", "Claim text.")).toBe(false);
    expect(showsProtection("pvp_us", null)).toBe(false);
    const badge = decode(renderToStaticMarkup(ProtectionBadge({ protection: "pvp_us", note: "Claim text." })));
    expect(badge).toContain("US Plant Variety Protection");
    expect(badge).toContain("Claim text.");
    expect(renderToStaticMarkup(ProtectionBadge({ protection: "none_stated", note: null }))).toBe("");
  });

  it("renders beacons and clamps as null (behavior-only clients)", () => {
    expect(renderToStaticMarkup(<ViewBeacon varietySlug="x" />)).toBe("");
    expect(renderToStaticMarkup(<ResultsScrollClamp targetId="a" regionId="b" navKey="c" />)).toBe("");
  });
});

describe("VarietyCard (browse context)", () => {
  it("links the whole card with Latin, name, crop, and seller line", () => {
    const [blueRibbon, roseQueen] = state().listItems;
    const html = decode(renderToStaticMarkup(VarietyCard({ v: blueRibbon! })));
    expect(html).toContain('href="/variety/sweet-pea-blue-ribbon"');
    expect(html).toContain('aria-label="Blue Ribbon — Sweet Pea"');
    expect(html).toContain("Lathyrus odoratus");
    expect(html).toContain("Blue Ribbon");
    expect(html).toContain("2 sellers");
    expect(decode(renderToStaticMarkup(VarietyCard({ v: roseQueen! })))).toContain("No sellers yet");
  });

  it("grids every sibling", () => {
    const html = renderToStaticMarkup(VarietyGrid({ items: state().listItems.slice(0, 3) }));
    expect(html.match(/href="\/variety\//g)).toHaveLength(3);
  });
});
