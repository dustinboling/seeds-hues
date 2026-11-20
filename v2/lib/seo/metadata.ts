/** Metadata builders (S1/S2/S3). Titles get the root template `%s | seeds.hues.flowers`. No prices (R1). */
import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/config";
import { shortCommonName } from "@/lib/format";
import { imageUrl } from "@/lib/images";
import type { SellerDetail, SellerState, VarietyDetail } from "@/lib/validators";

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

/**
 * Own-work variety or crop illustration as the share image: the stored media path rendered as a
 * 1120-wide scale-down transformation from our own image CDN (lib/images; absolute URL on
 * images.seeds.hues.flowers since the 2026-11-18 migration). No `type`: format=auto negotiates the
 * format per client (AVIF/WebP, else the original's format), so a fixed MIME type could be wrong.
 * 1120×2240 is the illustration standard (every variety original is exactly that size).
 */
export function mediaOgImage(path: string, alt: string): OgImage {
  return { url: imageUrl(path, { width: 1120 }), width: 1120, height: 2240, alt };
}

export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  follow?: boolean;
  og?: OgImage;
  absoluteTitle?: boolean;
}): Metadata {
  const image = opts.og ?? ogImage("site", "default", SITE_NAME);
  const canonical = opts.path === "/" ? SITE_URL : `${SITE_URL}${opts.path}`;
  return {
    title: opts.absoluteTitle ? { absolute: opts.title } : opts.title,
    description: opts.description,
    alternates: { canonical },
    robots: opts.noindex ? { index: false, follow: opts.follow ?? true } : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: canonical,
      title: opts.title,
      description: opts.description,
      images: [image],
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image.url],
    },
  };
}

const sellerCount = (n: number) => (n === 0 ? "No Seller Listing Yet" : `${n} Seller${n === 1 ? "" : "s"}`);

/** "Where to buy" intent, written from facts: variety, crop, and the number of sellers listing it. */
export function varietyTitle(v: VarietyDetail): string {
  const n = new Set(v.listings.map((l) => l.seller.slug)).size;
  return `${v.varietyName} ${shortCommonName(v.plant.commonName)} Seeds — Where to Buy (${sellerCount(n)})`;
}

export function varietyDescription(v: VarietyDetail): string {
  return clip(`${v.answer} ${v.varietyName} ${shortCommonName(v.plant.commonName).toLowerCase()} seeds${v.plant.latinName ? ` (${v.plant.latinName})` : ""}. ${v.description ?? ""}`);
}

export function sellerTitle(s: SellerDetail): string {
  return `${s.name} — Flower Seed Seller`;
}

export function sellerDescription(s: SellerDetail): string {
  const where = s.location ? ` in ${s.location}` : "";
  return clip(
    `${s.name}${where}: ${s.varietyCount} flower seed ${s.varietyCount === 1 ? "variety" : "varieties"} listed, each with its stock state and the date it was last checked. ${s.description ?? ""}`,
  );
}

/** /state/{slug}: an absolute title (no site-name template suffix). */
export function stateTitle(st: SellerState): string {
  return `Seed sellers in ${st.name} — Seed Directory`;
}

export function stateDescription(st: SellerState): string {
  const n = st.sellerCount;
  return clip(
    `${n} ${n === 1 ? "farm or seed company" : "farms and seed companies"} in ${st.name} ${n === 1 ? "lists" : "list"} flower seed with the Seed Directory, with the varieties each one carries and when each listing was last checked.`,
  );
}
