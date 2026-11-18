import { imageSrcSet, imageUrl } from "@/lib/images";
import type { Media } from "@/lib/validators";

/**
 * Hero illustration for a variety page: the first own-work media row, served from our own image
 * CDN through lib/images (R2 original + scale-down transformation, migrated 2026-11-18; never a
 * seller photo, never a hotlink). Fixed width/height attributes give the browser the 1:2 aspect
 * ratio before the file arrives, so there is no layout shift.
 * The crop page reuses it for its own illustration (testId "crop-hero").
 */
export function VarietyHeroImage({ media, label, testId = "variety-hero" }: { media: Media; label: string; testId?: string }) {
  // Responsive for variety AND crop artwork: 768- and 1120-wide transformations of the same
  // original (the hero displays at ≤380 CSS px, so 768 covers 2x DPR; 1120 is the full size).
  const srcSet = imageSrcSet(media.url, [768, 1120]);
  // The frame is pinned to the illustration standard's 1:2 with contain-fit on paper: the R2
  // originals of some crop paintings are not 1:2 (the old served copies were padded to 1120×2240),
  // and scale-down preserves the original aspect, so the paper padding is drawn here instead.
  // For 1:2 originals (every variety painting) this is identical to the old rendering.
  return (
    <figure className="mt-6" data-testid={testId}>
      {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(media.url, { width: 1120 })}
        srcSet={srcSet}
        sizes="(max-width: 480px) 92vw, 380px"
        alt={`${label} — illustration`}
        width={1120}
        height={2240}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="card block aspect-[1/2] h-auto w-full max-w-[380px] bg-paper object-contain"
      />
    </figure>
  );
}
