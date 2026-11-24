/**
 * /llms.txt renderer — ported as-is from v2/app/llms.txt/route.ts (same
 * lines, same order, same data): site summary with live counts, seller
 * policy, data model, key pages, the full crop list with counts, the seller
 * list with locations, API links, trademark disclaimer. Hygiene, not
 * visibility work. Counts are live at serve time (cached max-age=3600 + SWR
 * like today — acceptable for a hygiene file).
 */
import { proseCommonName } from "../lib/format";
import type { ApiCrop, ApiSellerItem, CatalogCounts } from "./types";

export interface LlmsInput {
  siteUrl: string;
  siteDescription: string;
  botUserAgent: string;
  conflictOfInterest: string;
  trademarkDisclaimer: string;
  counts: CatalogCounts;
  crops: ApiCrop[];
  sellers: ApiSellerItem[];
}

export function renderLlmsTxt(input: LlmsInput): string {
  const { siteUrl } = input;
  const lines = [
    "# seeds.hues.flowers",
    "",
    `> ${input.siteDescription}`,
    "",
    `The directory currently lists ${input.counts.varieties} flower seed varieties across ${input.counts.plants} crops, sold by ${input.counts.sellers} US sellers (${input.counts.listings} listings). Each listing shows its stock state as last seen and the date it was last checked. No prices are shown. Hues Floral Park owns and operates the site.`,
    "",
    "## Seller policy",
    "- Sellers are US farms and seed companies of any size.",
    "- A seller does not have to grow the seed it sells; bought-in seed is listed the same way.",
    "- Sellers do not pay for placement. Any seller may correct, claim or remove its listing; removals are honored within 48 hours.",
    `- ${input.conflictOfInterest}`,
    "",
    "## Data model",
    "- A crop is a species (common + Latin name, e.g. Sweet Pea, Lathyrus odoratus) with a page at /crop/{slug}.",
    "- A variety belongs to one crop (e.g. King's Ransom sweet pea) and has its own page at /variety/{slug}. A breeder's series has a page at /series/{slug}.",
    "- A seller has a page at /seller/{slug}. A listing links one variety to one seller, with its availability (in stock / sold out / preorder / shop closed / unknown), last-checked date and source.",
    "- Unknown facts are shown as Unknown. Ratings read \"Not yet rated\" until real reviews exist; none are invented.",
    "",
    "## Key pages",
    `- [Crops](${siteUrl}/crop)`,
    `- [All varieties](${siteUrl}/variety)`,
    `- [All sellers](${siteUrl}/seller)`,
    `- [About the data](${siteUrl}/about/data)`,
    `- [Our crawler](${siteUrl}/about/bot) — ${input.botUserAgent}`,
    `- [Search](${siteUrl}/search?q=sweet+pea)`,
    "",
    "## Crops",
    ...input.crops.map(
      (p) => `- [${proseCommonName(p.commonName)}${p.latinName ? ` (${p.latinName})` : ""}](${siteUrl}/crop/${p.slug}): ${p.varietyCount} varieties, ${p.varietiesWithSellers} with sellers`,
    ),
    "",
    "## Sellers",
    ...input.sellers.map((s) => `- [${s.name}](${siteUrl}/seller/${s.slug})${s.location ? ` — ${s.location}` : ""}`),
    "",
    "## API",
    `- [OpenAPI 3.1 contract](${siteUrl}/api/v1/openapi.json) — JSON, envelope { data, page, meta, error }; meta carries catalog_seq.`,
    `- [API documentation](${siteUrl}/api-docs)`,
    `- [Full catalog snapshot for apps](${siteUrl}/api/v1/sync/snapshot) — one request instead of thousands.`,
    "",
    "## Legal",
    `- ${input.trademarkDisclaimer}`,
    "",
  ];
  return lines.join("\n");
}
