/**
 * JSON-LD builders — exactly the canonical §5 "Structured data" table (R4):
 *  - All pages: BreadcrumbList (where there is a trail)
 *  - Home: WebSite + Organization
 *  - Crop, series: ItemList of varieties
 *  - Seller: Organization + ItemList of listings
 *  - Variety: BreadcrumbList + ItemList of sellers
 * PROHIBITED anywhere (Phase 1 shows neither prices nor ratings, so these would be invalid or
 * invented): Product, AggregateOffer, Offer, AggregateRating, Review, FAQPage, priceValidUntil.
 */
import { OWNER_SITE_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/config";
import type { SellerDetail, VarietyDetail } from "@/lib/validators";

type Json = Record<string, unknown>;

export const PROHIBITED_JSONLD = [
  "Product",
  "AggregateOffer",
  "Offer",
  "offers",
  "price",
  "lowPrice",
  "FAQPage",
  "AggregateRating",
  "Review",
  "priceValidUntil",
  "aggregateRating",
  "review",
] as const;

export class ProhibitedJsonLdError extends Error {}

/** Throws if any prohibited @type or key appears anywhere in the graph. */
export function assertNoProhibitedJsonLd(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoProhibitedJsonLd(v, `${path}[${i}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [k, v] of Object.entries(value)) {
    if ((PROHIBITED_JSONLD as readonly string[]).includes(k)) throw new ProhibitedJsonLdError(`Prohibited JSON-LD key ${k} at ${path}`);
    if (k === "@type") {
      const types = Array.isArray(v) ? v : [v];
      for (const t of types)
        if ((PROHIBITED_JSONLD as readonly string[]).includes(String(t)))
          throw new ProhibitedJsonLdError(`Prohibited JSON-LD @type ${String(t)} at ${path}`);
    }
    assertNoProhibitedJsonLd(v, `${path}.${k}`);
  }
}

export const abs = (path: string) => (path.startsWith("http") ? path : path === "/" ? SITE_URL : `${SITE_URL}${path}`);

export function websiteJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: { "@type": "Organization", name: "Hues Floral Park", url: OWNER_SITE_URL },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={query}` },
      "query-input": "required name=query",
    },
  };
}

/** Home: the site's own Organization (Hues Floral Park owns and operates it). */
export function siteOrganizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hues Floral Park",
    url: OWNER_SITE_URL,
    description: `Hues Floral Park owns and operates ${SITE_NAME}, a directory of flower seed varieties and the US sellers who sell them.`,
  };
}

export function breadcrumbJsonLd(items: { name: string; href: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: abs(c.href) })),
  };
}

export function itemListJsonLd(name: string, items: { name: string; href: string }[], startPosition = 1): Json {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: startPosition + i,
      url: abs(it.href),
      name: it.name,
    })),
  };
}

/** Variety: ItemList of the sellers listing it (links to our seller pages). */
export function varietySellersJsonLd(v: VarietyDetail): Json {
  const seen = new Set<string>();
  const sellers = v.listings.filter((l) => !seen.has(l.seller.slug) && seen.add(l.seller.slug));
  return itemListJsonLd(
    `Where to buy ${v.varietyName} seed`,
    sellers.map((l) => ({ name: l.seller.name, href: `/seller/${l.seller.slug}` })),
  );
}

/** "Accord, NY" → locality + region. Anything else → no address (never invent one). */
export function parseLocation(location: string | null): Json | null {
  if (!location) return null;
  const m = /^([A-Za-z .'-]+),\s*([A-Z]{2})$/.exec(location.trim());
  if (!m) return null;
  return { "@type": "PostalAddress", addressLocality: m[1]!.trim(), addressRegion: m[2] };
}

export function organizationJsonLd(s: SellerDetail): Json {
  const address = parseLocation(s.location);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.name,
    ...(s.homepage ? { url: s.homepage } : {}),
    ...(s.description ? { description: s.description } : {}),
    ...(address ? { address } : {}),
    mainEntityOfPage: abs(`/seller/${s.slug}`),
  };
}
