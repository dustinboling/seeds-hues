import { imageSrcSet, imageUrl } from "@/lib/images";

/** Stored path of divider motif B (seed head clustered in the centre; 2400×518 master, 4.63:1). */
export const MOTIF_B_PATH = "/ornaments/motif-divider-b.webp";

/** Rendition widths requested from the image CDN; 1200 is the served size (covers ≤600 CSS px at 2×). */
const MOTIF_B_WIDTHS = [600, 900, 1200] as const;

/**
 * Display width per placement, inside the art-direction bands (FINAL-B-PLACEMENT-GUIDANCE.md):
 * home-page section break 420–540 px desktop, footer-adjacent centrepiece 360–520 px. The 92vw cap
 * holds small phones at the guidance's mobile floor case; `sizes` mirrors the CSS width exactly.
 */
const VARIANTS = {
  home: { width: "w-[min(480px,92vw)]", sizes: "min(480px, 92vw)" },
  footer: { width: "w-[min(440px,92vw)]", sizes: "min(440px, 92vw)" },
} as const satisfies Record<string, { width: string; sizes: string }>;

export type MotifDividerVariant = keyof typeof VARIANTS;

/**
 * Divider motif B: a centred painted ornament for MAJOR breaks only — not a general divider (the
 * thin divider-stem rule stays everywhere separation is the job). Rendered through lib/images as
 * scale-down transformations of its R2 original, so it is always shown whole: never cropped, never
 * stretched (height auto at the intrinsic 2400×518 aspect), never upscaled past the served file.
 *
 * Its warm cream ground is painted in and matches --color-paper, so it must only be placed on the
 * page's paper ground (never inside the paper-deep <footer> or a bordered card/panel).
 *
 * Below a 360 px viewport the slot would fall under the guidance's ~320 px minimum, so the motif
 * gives way to the thin divider-stem rule there (also covers text-zoom reflow). A lazy image that
 * is display:none is not fetched.
 *
 * Purely decorative: aria-hidden wrapper, empty alt. No vertical margins are baked in — callers
 * pass className for the whitespace (clear space ≥ ~half the displayed height above and below).
 */
export function MotifDivider({ variant, className }: { variant: MotifDividerVariant; className?: string }) {
  const v = VARIANTS[variant];
  return (
    <div aria-hidden="true" data-testid="motif-b" className={["w-full", className].filter(Boolean).join(" ")}>
      {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(MOTIF_B_PATH, { width: 1200 })}
        srcSet={imageSrcSet(MOTIF_B_PATH, MOTIF_B_WIDTHS)}
        sizes={v.sizes}
        alt=""
        width={2400}
        height={518}
        loading="lazy"
        decoding="async"
        className={`mx-auto block h-auto max-w-full ${v.width} max-[360px]:hidden`}
      />
      <span className="divider-stem hidden max-[360px]:block" />
    </div>
  );
}
