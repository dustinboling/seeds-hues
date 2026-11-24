import { GENERIC_POD_MOTIF, podArtForPlant } from "../../lib/pod-ornaments";
import { imageSrcSet, imageUrl } from "../../lib/images";
import type { ApiMedia } from "../../data/types";

/**
 * Card illustration for the unified variety card (every grid): the art
 * frame resolves the tier order, first hit wins —
 *  1. the variety's own first plate — alt "{varietyName} — illustration";
 *  2. the crop's first plate — alt "{crop common name} — illustration";
 *  3. the crop's seed-pod device (`podArtForPlant`), decorative;
 *  4. the generic seed-pod device (GENERIC_POD_MOTIF), decorative.
 * Ported from v2/components/variety/VarietyCardImage.tsx. Plates render
 * whole (contain-fit on paper, our own image CDN — never cropped, never
 * hotlinked); the fixed aspect reserves the space before the file arrives,
 * so grids have no layout shift. Cards never load the 1120-wide hero size.
 */
export function VarietyCardImage({
  media,
  cropMedia,
  varietyName,
  cropName,
  plantSlug,
}: {
  media: ApiMedia[];
  cropMedia: ApiMedia[];
  varietyName: string;
  cropName: string;
  plantSlug?: string;
}) {
  const varietyPlate = media[0];
  const plate = varietyPlate ?? cropMedia[0];
  if (plate) {
    const isVarietyArtwork = Boolean(varietyPlate) && plate.url.startsWith("/artwork/") && !plate.url.startsWith("/artwork/crops/");
    const srcSet = isVarietyArtwork ? imageSrcSet(plate.url, [480, 768]) : undefined;
    return (
      <div className="variety-card-image" data-testid="variety-card-image">
        {/* A plain <img>: sizing is done by the image CDN's transformations. */}
        <img
          src={imageUrl(plate.url, { width: 480 })}
          srcSet={srcSet}
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
          alt={varietyPlate ? `${varietyName} — illustration` : `${cropName} — illustration`}
          width={480}
          height={960}
          loading="lazy"
          decoding="async"
          style={{ forcedColorAdjust: "none" }}
          className="variety-card-img"
        />
      </div>
    );
  }
  const motif = podArtForPlant(plantSlug)?.motif ?? GENERIC_POD_MOTIF;
  return (
    <div className="variety-card-image variety-card-placeholder" data-testid="variety-card-placeholder">
      <img
        src={imageUrl(motif, { width: 480 })}
        alt=""
        aria-hidden="true"
        width={480}
        height={480}
        loading="lazy"
        decoding="async"
        style={{ forcedColorAdjust: "none" }}
        className="variety-card-img"
      />
    </div>
  );
}
