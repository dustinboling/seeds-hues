import type { Media } from "@/lib/validators";

/**
 * Hero illustration for a variety page: the first own-work media row, served from this app's own
 * /artwork/ assets (never a seller photo, never a hotlink). Fixed width/height attributes give the
 * browser the 1:2 aspect ratio before the file arrives, so there is no layout shift.
 * The crop page reuses it for its own illustration (testId "crop-hero").
 */
export function VarietyHeroImage({ media, label, testId = "variety-hero" }: { media: Media; label: string; testId?: string }) {
  // Responsive variant for variety artwork only: /artwork/<file>.webp also ships a 768-wide copy
  // under /artwork/w768/ (the hero displays at ≤380 CSS px, so 768 covers 2x DPR). Crop artwork
  // (/artwork/crops/…) and any other media keep the single file.
  const isVarietyArtwork = media.url.startsWith("/artwork/") && !media.url.startsWith("/artwork/crops/");
  const srcSet = isVarietyArtwork
    ? `${media.url.replace("/artwork/", "/artwork/w768/")} 768w, ${media.url} 1120w`
    : undefined;
  return (
    <figure className="mt-6" data-testid={testId}>
      {/* A plain <img>: the file is a fixed-size local asset, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={media.url}
        srcSet={srcSet}
        sizes={srcSet ? "(max-width: 480px) 92vw, 380px" : undefined}
        alt={`${label} — illustration`}
        width={1120}
        height={2240}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="card block h-auto w-full max-w-[380px]"
      />
    </figure>
  );
}
