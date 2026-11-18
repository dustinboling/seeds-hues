import { podArtForPlant } from "@/lib/data/pod-ornaments";
import { imageSrcSet, imageUrl } from "@/lib/images";
import type { Media } from "@/lib/validators";

/**
 * Card illustration for a variety (variety grids on /variety, crop, series and variety pages):
 * the first own-work media row, shown WHOLE (contain-fit) on the paper ground in the
 * illustration standard's 1:2 frame, like CropCardImage. The fixed aspect reserves the space
 * before the file arrives, so the grid has no layout shift.
 *
 * Cards never load the 1120-wide hero size. Images come from our own image CDN through lib/images
 * (R2 original + on-the-fly scale-down transformation, migrated 2026-11-18): variety artwork gets
 * a 480-wide src with a 480w/768w srcset; crop media (/artwork/crops/…) and any other media url
 * get the 480-wide transformation as src. The stored media url is never rewritten in data.
 *
 * Without media the same frame is a placeholder on paper: the crop's seed-pod motif
 * (/ornaments/motif-<key>.webp from lib/data/pod-ornaments.ts by plantSlug, rendered through
 * lib/images at 480 wide) when the crop has pod art, otherwise the theme's divider-stem motif. Both are decorative (alt="", aria-hidden):
 * never a broken image, a stock photo or a guessed painting of the variety.
 */
export function VarietyCardImage({ media, varietyName, plantSlug }: { media: Media[]; varietyName: string; plantSlug?: string }) {
  const m = media[0];
  if (!m) {
    const motif = podArtForPlant(plantSlug)?.motif;
    return (
      <div
        className="card-image mb-2 flex aspect-[1/2] w-full items-center justify-center overflow-hidden rounded-lg bg-paper"
        data-testid="variety-card-placeholder"
      >
        {motif ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl(motif, { width: 480 })}
              alt=""
              aria-hidden="true"
              width={480}
              height={480}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-8 opacity-90"
            />
          </>
        ) : (
          <span aria-hidden="true" className="divider-stem w-full opacity-50" />
        )}
      </div>
    );
  }
  const isVarietyArtwork = m.url.startsWith("/artwork/") && !m.url.startsWith("/artwork/crops/");
  const srcSet = isVarietyArtwork ? imageSrcSet(m.url, [480, 768]) : undefined;
  return (
    <div className="card-image mb-2 aspect-[1/2] w-full overflow-hidden rounded-lg bg-paper" data-testid="variety-card-image">
      {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(m.url, { width: 480 })}
        srcSet={srcSet}
        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 22vw"
        alt={`${varietyName} — illustration`}
        width={480}
        height={960}
        loading="lazy"
        decoding="async"
        className="block h-full w-full object-contain"
      />
    </div>
  );
}
