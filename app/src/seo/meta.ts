/**
 * Page metadata builders — ported from v2/lib/seo/metadata.ts (same titles,
 * same descriptions, same canonical/OG/Twitter composition; the Next
 * Metadata type replaced by this tree's plain HeadTags). Only the builders
 * Slice 2 templates need are ported; slug-template builders arrive with
 * their slices.
 */
import { SITE_NAME, SITE_URL } from "../site";

export function clip(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).trim()}…`;
}

export interface OgImage {
  url: string;
  width: number;
  height: number;
  alt: string;
  /** MIME type; omitted when the served format is negotiated (image CDN, format=auto). */
  type?: string;
}

/** Generated OG card (`/og/{kind}/{slug}`, 1200×630 PNG). */
export function ogImage(kind: "variety" | "seller" | "crop" | "site", slug: string, alt: string): OgImage {
  return { url: `${SITE_URL}/og/${kind}/${slug}`, width: 1200, height: 630, alt, type: "image/png" };
}

/** Plain head tags for one page (rendered by the route's +Head). */
export interface HeadTags {
  /** Full document title, template already applied. */
  title: string;
  description: string;
  canonical: string;
  robots: string;
  og: OgImage & { title: string; description: string; url: string };
  twitter: { card: "summary_large_image"; title: string; description: string; image: string };
}

export function pageHead(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  follow?: boolean;
  og?: OgImage;
  absoluteTitle?: boolean;
}): HeadTags {
  const image = opts.og ?? ogImage("site", "default", SITE_NAME);
  const canonical = opts.path === "/" ? SITE_URL : `${SITE_URL}${opts.path}`;
  const title = opts.absoluteTitle ? opts.title : `${opts.title} | ${SITE_NAME}`;
  const robots = opts.noindex ? `noindex, ${opts.follow ?? true ? "follow" : "nofollow"}` : "index, follow";
  return {
    title,
    description: opts.description,
    canonical,
    robots,
    og: { ...image, title: opts.title, description: opts.description, url: canonical },
    twitter: { card: "summary_large_image", title: opts.title, description: opts.description, image: image.url },
  };
}
