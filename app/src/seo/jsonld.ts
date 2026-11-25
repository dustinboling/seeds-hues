/**
 * JSON-LD builders — ported from v2/lib/seo/jsonld.ts (same blocks, same
 * shapes). Only the builders Slice 2 templates emit are ported; the variety
 * sellers list, seller Organization, and location parser arrive with their
 * slices. Every payload passes assertNoProhibitedJsonLd at render (JsonLd).
 */
import { OWNER_SITE_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../site";

export type Json = Record<string, unknown>;

export const abs = (path: string): string => (path.startsWith("http") ? path : path === "/" ? SITE_URL : `${SITE_URL}${path}`);

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

/**
 * Home: the site's own Organization (Hues Floral Park owns and operates it).
 * Port additions per Bea §11 item 2: logo (our own host's icon) and sameAs.
 * sameAs carries only verified URLs — hues.flowers itself; no social or
 * Wikidata URL is verified at build time, so none is listed (never guessed).
 */
export function siteOrganizationJsonLd(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Hues Floral Park",
    url: OWNER_SITE_URL,
    description: `Hues Floral Park owns and operates ${SITE_NAME}, a directory of flower seed varieties and the US sellers who sell them.`,
    logo: `${SITE_URL}/icons/hues-icon-512.png`,
    sameAs: [OWNER_SITE_URL],
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
export function varietySellersJsonLd(v: {
  varietyName: string;
  listings: { seller: { slug: string; name: string } }[];
}): Json {
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

export function organizationJsonLd(s: {
  slug: string;
  name: string;
  homepage: string | null;
  description: string | null;
  location: string | null;
}): Json {
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
