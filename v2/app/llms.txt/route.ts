/**
 * /llms.txt (S7, canonical §5 GEO): site name, a one-paragraph summary, and links to crop pages,
 * the API description and the data policy. Generated from the DB + site config at request time.
 */
import { getServices } from "@/lib/services/context";
import { BOT_USER_AGENT, CONFLICT_OF_INTEREST, SITE_DESCRIPTION, SITE_URL, TRADEMARK_DISCLAIMER } from "@/lib/config";
import { proseCommonName } from "@/lib/services/template";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const { catalog } = await getServices();
  const [counts, crops, sellers] = await Promise.all([
    catalog.counts(),
    catalog.listCrops({ offset: 0, limit: 500 }), // every crop; the catalog passed 100 in Nov 2026
    catalog.listSellers({ offset: 0, limit: 100 }),
  ]);
  const lines = [
    "# seeds.hues.flowers",
    "",
    `> ${SITE_DESCRIPTION}`,
    "",
    `The directory currently lists ${counts.varieties} flower seed varieties across ${counts.plants} crops, sold by ${counts.sellers} small farms (${counts.listings} listings). Each listing shows its stock state as last seen and the date it was last checked. No prices are shown. Hues Floral Park owns and operates the site.`,
    "",
    "## Seller policy",
    "- Sellers are small farms and seed shops ONLY, each approved by hand. Large seed companies are not listed.",
    "- A seller does not have to grow the seed it sells; bought-in seed is listed the same way.",
    "- Sellers do not pay for placement. Any farm may correct, claim or remove its listing; removals are honoured within 48 hours.",
    `- ${CONFLICT_OF_INTEREST}`,
    "",
    "## Data model",
    "- A crop is a species (common + Latin name, e.g. Sweet Pea, Lathyrus odoratus) with a page at /crop/{slug}.",
    "- A variety belongs to one crop (e.g. King's Ransom sweet pea) and has its own page at /variety/{slug}. A breeder's series has a page at /series/{slug}.",
    "- A seller has a page at /seller/{slug}. A listing links one variety to one seller, with its availability (in stock / sold out / preorder / shop closed / unknown), last-checked date and source.",
    "- Unknown facts are shown as Unknown. Ratings read \"Not yet rated\" until real reviews exist; none are invented.",
    "",
    "## Key pages",
    `- [Crops](${SITE_URL}/crop)`,
    `- [All varieties](${SITE_URL}/variety)`,
    `- [All sellers](${SITE_URL}/seller)`,
    `- [About the data](${SITE_URL}/about/data)`,
    `- [Our crawler](${SITE_URL}/about/bot) — ${BOT_USER_AGENT}`,
    `- [Search](${SITE_URL}/search?q=sweet+pea)`,
    "",
    "## Crops",
    ...crops.items.map(
      (p) => `- [${proseCommonName(p.commonName)}${p.latinName ? ` (${p.latinName})` : ""}](${SITE_URL}/crop/${p.slug}): ${p.varietyCount} varieties, ${p.varietiesWithSellers} with sellers`,
    ),
    "",
    "## Sellers",
    ...sellers.items.map((s) => `- [${s.name}](${SITE_URL}/seller/${s.slug})${s.location ? ` — ${s.location}` : ""}`),
    "",
    "## API",
    `- [OpenAPI 3.1 contract](${SITE_URL}/api/v1/openapi.json) — JSON, envelope { data, page, meta, error }; meta carries catalog_seq.`,
    `- [API documentation](${SITE_URL}/api-docs)`,
    `- [Full catalog snapshot for apps](${SITE_URL}/api/v1/sync/snapshot) — one request instead of thousands.`,
    "",
    "## Legal",
    `- ${TRADEMARK_DISCLAIMER}`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
