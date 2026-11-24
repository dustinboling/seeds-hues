import { GENERIC_POD_MOTIF, podArtForPlant } from "@/lib/data/pod-ornaments";
import { imageSrcSet, imageUrl } from "@/lib/images";
import type { Media } from "@/lib/validators";

/**
 * Card illustration for the unified variety card (both contexts, every grid): the art
 * frame resolves Elena's tier order (ART-GRID-CARD §1), first hit wins —
 *  1. the variety's own first plate — alt "{varietyName} — illustration", ground paper;
 *  2. the crop's first plate — alt "{crop common name} — illustration", ground paper;
 *  3. the crop's seed-pod device (`podArtForPlant`), decorative, on paper-deep;
 *  4. the generic seed-pod device (GENERIC_POD_MOTIF), decorative, on paper-deep.
 * Tiers 3–4 are one tier with two forms of one device; the in-frame divider stem is
 * removed as a tier — no stem instance appears on the card in any state. Plates render
 * whole (contain-fit on paper, our own image CDN through lib/images — never cropped,
 * never hotlinked); the fixed aspect reserves the space before the file arrives, so
 * grids have no layout shift.
 *
 * Cards never load the 1120-wide hero size. Variety artwork gets a 480-wide src with a
 * 480w/768w srcset; crop media (/artwork/crops/…) and any other media url get the
 * 480-wide transformation as src. The stored media url is never rewritten in data.
 *
 * Forced colors: the artwork <img> is a true color specimen and keeps its colors
 * (forced-color-adjust: none, scoped to the image element only — the SH-16b precedent);
 * the frame container's grounds remap like all grounds.
 */
export function VarietyCardImage({
  media,
  cropMedia,
  varietyName,
  cropName,
  plantSlug,
}: {
  media: Media[];
  cropMedia: Media[];
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
      <div className="card-image mb-2 aspect-[1/2] w-full overflow-hidden rounded-inner bg-paper" data-testid="variety-card-image">
        {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
          className="block h-full w-full object-contain"
        />
      </div>
    );
  }
  const motif = podArtForPlant(plantSlug)?.motif ?? GENERIC_POD_MOTIF;
  return (
    <div
      className="card-image mb-2 flex aspect-[1/2] w-full items-center justify-center overflow-hidden rounded-inner bg-paper-deep"
      data-testid="variety-card-placeholder"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(motif, { width: 480 })}
        alt=""
        aria-hidden="true"
        width={480}
        height={480}
        loading="lazy"
        decoding="async"
        style={{ forcedColorAdjust: "none" }}
        className="h-full w-full object-contain p-8 opacity-90"
      />
    </div>
  );
}
