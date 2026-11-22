/**
 * The seller-description publication guard (audit 2026-11-21 C1 + C2): prices are
 * captured but NEVER shown, and working notes never publish as About copy.
 * descriptionViolations() is pure — these cases pin its classes without a database.
 */
import { describe, expect, it } from "vitest";
import { descriptionViolations } from "@/lib/services/admin";

describe("price: a currency amount in any form", () => {
  it.each([
    "Packets are $4.65 each.",
    "Packets are $ 4.65 each.",
    "Priced at USD 5 per packet.",
    "Each packet is 5 USD.",
    "Packets cost 4 dollars each.",
    "A packet is 4 dollar.",
    "Each one is 5 bucks.",
    "The price $4.65 covers shipping.",
    "Priced at $4.65.",
    "Price: 4.65 per packet.",
  ])("flags %s", (text) => {
    expect(descriptionViolations(text)).toContain("price");
  });

  it("the bare word dollar(s) with no amount is clean", () => {
    for (const text of [
      "We accept dollars at the farm stand.",
      "Every dollar stays on the farm.",
      "A packet costs a few dollars.",
      "Our prices are fair and stable.",
    ]) {
      expect(descriptionViolations(text), text).not.toContain("price");
    }
  });
});

describe("internal_marker: working-note scaffolding", () => {
  it.each([
    "Anchor: Basil 'Cinnamon' — working note",
    "badge: NO — leave OFF",
    "First line.\nFeed: none — products.json returned 404",
    "First line.\n  Note: check this",
    "Pending Hue review before publishing.",
    "HUE REVIEW needed.",
    "Coordinator to verify the address.",
    "COORDINATOR TO VERIFY",
    "Anchor text verified 2026-11-19",
    "Verified 2026-11-19 by the team.",
  ])("flags %s", (text) => {
    expect(descriptionViolations(text)).toContain("internal_marker");
  });

  it("mid-sentence lookalikes are clean", () => {
    for (const text of [
      "Please note our shipping schedule changes in winter.",
      "Take note: we ship on Mondays.",
      "The feed store next door sells our seed.",
      "We verified the address last week.",
      "Reviewed by Hue last spring.",
    ]) {
      expect(descriptionViolations(text), text).not.toContain("internal_marker");
    }
  });
});

describe("combined", () => {
  it("the audit's C1 shape flags both classes", () => {
    expect(descriptionViolations("Anchor: Basil 'Cinnamon' — $4.65 packet, verified 2026-11-19")).toEqual(["price", "internal_marker"]);
  });

  it("ordinary factual copy is clean", () => {
    expect(descriptionViolations("We grow heirloom zinnias on our family farm in Vermont.")).toEqual([]);
    expect(descriptionViolations("")).toEqual([]);
  });
});

describe("audit corpus (2026-11-21 C2): verbatim production records flag", () => {
  it.each([
    "Store address on product page: '5500 Blaine Ave | Inver Grove Heights, MN 55076' and 'Minnesota's Destination Garden Center' | Feed: None identified (Magento store; no public product feed found) | Badge: NO - Large Minnesota garden center, not a small family-run farm",
    "Grower based in Iowa — on-page text: 'after moving to Iowa in 1984' and 'They never get as big here in Iowa'. Site is a one-grower heirloom seed preservation farm (Calamus, Iowa). | Feed: none — Wix site, no product feed found | Badge: YES - Clearly small and family-run: one-grower preservation farm, hand-pollinated small-batch seed, ~120 winter squash varieties, grower writes in first person about his own plantings and seed saving.",
    "HQ 1734 Railroad Place, Hall, NY 14463; large full-line seed company, subsidiary of GROWMARK, Inc. (~280 employees). | Feed: no JSON feed — custom storefront; /products.json returns HTML; category pages only. | Badge: NO — national seed company, not a small farm.",
    "Small family farm in Williams, Oregon (Richo Cech); certified-organic seed grown on-farm; homepage states 'Certified organic · Williams, Oregon' and 'Handmade in Williams, Oregon'. | Feed: WooCommerce Store API https://strictlymedicinalseeds.com/wp-json/wc/store/v1/products (verified fetchable). | Badge: YES — small family farm.",
    "Baker Creek Heirloom Seed Co. (rareseeds.com), Mansfield, Missouri — large US heirloom seed company. Anchor: Zinnia 'Benary's Giant Salmon Rose' listed on rareseeds.com, verified on the product page 2026-11-19. Whole catalog screened via Shopify products.json (1,616 products).",
    "Homepage states 'Based in California, Lush-Farm creates plantable seed calendars and cards'; customer reviews mention an LA garden, Ramona CA, and Paso Robles. | Feed: none — https://angletok.com/products.json?limit=250 returned 404; no Shopify feed found | Badge: NO - Small-business appearance but family-run status not evidenced; leave OFF pending Hue review.",
  ])("flags audit record %#", (text) => {
    expect(descriptionViolations(text)).toContain("internal_marker");
  });

  it("the pipe-separated Feed:/Badge: shape flags without any other signal", () => {
    expect(descriptionViolations("A family seed house in Ohio. | Feed: none — no product feed found | Badge: YES — small family farm.")).toContain("internal_marker");
  });

  it("a mid-sentence Anchor: flags without any other signal", () => {
    expect(descriptionViolations("A large Missouri heirloom seed company. Anchor: Zinnia 'Benary's Giant' listed on the product page.")).toContain("internal_marker");
  });
});

describe("dated verification stamps (Quinn N3)", () => {
  it.each([
    "Zinnia 'Benary's Giant Salmon Rose' listed on rareseeds.com, verified on the product page 2026-11-19.",
    "WooCommerce Store API (verified fetchable 2026-11-20).",
  ])("flags %s", (text) => {
    expect(descriptionViolations(text)).toContain("internal_marker");
  });

  it("an undated verified stays clean", () => {
    for (const text of [
      "WooCommerce Store API https://strictlymedicinalseeds.com/wp-json/wc/store/v1/products (verified fetchable).",
      "We verified the address last week.",
    ]) {
      expect(descriptionViolations(text), text).toEqual([]);
    }
  });
});

describe("clean lookalikes stay fully clean (no price, no internal_marker)", () => {
  it.each([
    "Take note: we ship on Mondays.",
    "Please note our shipping schedule changes in winter.",
    "The feed store next door sells our seed.",
    "We verified the address last week.",
    "Reviewed by Hue last spring.",
    "We accept dollars at the farm stand.",
    "Hudson Valley grows open-pollinated seed on its farm in Accord, New York.",
    "We grow heirloom zinnias on our family farm in Vermont.",
  ])("clean: %s", (text) => {
    expect(descriptionViolations(text)).toEqual([]);
  });
});
