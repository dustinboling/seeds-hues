import { imageSrcSet, imageUrl } from "../../lib/images";
import type { ApiMedia } from "../../data/types";

/**
 * Hero illustration for a variety page: the first own-work media row, served
 * from our own image CDN through lib/images (never a seller photo, never a
 * hotlink). Ported from v2/components/variety/VarietyHeroImage.tsx. Fixed
 * width/height attributes give the browser the 1:2 aspect ratio before the
 * file arrives, so there is no layout shift. The crop page reuses it for its
 * own illustration (testId "crop-hero").
 */
export function VarietyHeroImage({ media, label, testId = "variety-hero" }: { media: ApiMedia; label: string; testId?: string }) {
  // Responsive for variety AND crop artwork: 768- and 1120-wide transformations of the same
  // original (the hero displays at ≤380 CSS px, so 768 covers 2x DPR; 1120 is the full size).
  const srcSet = imageSrcSet(media.url, [768, 1120]);
  return (
    <figure className="variety-hero" data-testid={testId}>
      {/* A plain <img>: sizing is done by the image CDN's transformations. */}
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
        className="variety-hero-img"
      />
    </figure>
  );
}
