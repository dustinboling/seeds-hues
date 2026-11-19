import { imageUrl } from "@/lib/images";

/**
 * Decorative theme illustrations (THEME-ART-DIRECTION.md §4): own-work watercolours. The table
 * keeps their stored /theme/ paths; rendering goes through lib/images (R2 original + scale-down
 * transformation from our own image CDN, migrated 2026-11-18) — never a hotlink, never a seller
 * photo. Every placement is decorative (alt=""), so screen readers skip it. Fixed width/height
 * attributes reserve the box before the file arrives (no layout shift). The home hero is the
 * page's LCP candidate: eager, fetchpriority high, and a <picture> source so phones (≤ 640 px)
 * get the 960-wide size and wider screens the 1600-wide one (both transformations of the same
 * 1600-wide original).
 */
const ART = {
  hero: { src: "/theme/hero-cutting-garden-960.webp", wide: "/theme/hero-cutting-garden-1600.webp", width: 960, height: 640 },
  "empty-no-sellers": { src: "/theme/empty-no-sellers.webp", wide: null, width: 880, height: 1000 },
  "empty-search": { src: "/theme/empty-search.webp", wide: null, width: 880, height: 1089 },
  "about-data": { src: "/theme/about-data.webp", wide: null, width: 1400, height: 933 },
  "farms-basket": { src: "/theme/farms-basket.webp", wide: null, width: 1400, height: 933 },
  "offline-path": { src: "/theme/offline-path.webp", wide: null, width: 880, height: 1373 },
  "farm-gate": { src: "/theme/farm-gate.webp", wide: null, width: 880, height: 1100 },
  "account-organizer": { src: "/theme/account-organizer.webp", wide: null, width: 880, height: 1100 },
} as const;

export type ThemeArtName = keyof typeof ART;

export function ThemeArt({ name, className = "", priority = false }: { name: ThemeArtName; className?: string; priority?: boolean }) {
  const art = ART[name];
  return (
    <picture>
      {/* No type attribute: format=auto picks AVIF/WebP per browser, so the format is not fixed. */}
      {art.wide ? <source media="(min-width: 641px)" srcSet={imageUrl(art.wide, { width: 1600 })} /> : null}
      {/* A plain <img> inside <picture>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      <img
        src={imageUrl(art.src, { width: art.width })}
        alt=""
        width={art.width}
        height={art.height}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : undefined}
        decoding="async"
        className={`block ${className}`}
      />
    </picture>
  );
}
