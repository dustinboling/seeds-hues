import { podArtForPlant } from "@/lib/data/pod-ornaments";
import type { Media } from "@/lib/validators";

/**
 * Card illustration for a variety (variety grids on /variety, crop, series and variety pages):
 * the first own-work media row, shown WHOLE (contain-fit) on the paper ground in the
 * illustration standard's 1:2 frame, like CropCardImage. The fixed aspect reserves the space
 * before the file arrives, so the grid has no layout shift.
 *
 * Cards never load the 1120-wide hero master. For variety artwork (/artwork/<file>.webp) the
 * 480- and 768-wide copies under /artwork/w480/ and /artwork/w768/ are derived from the master's
 * path; the app never generates image files. Any other media url is used as stored.
 *
 * Without media the same frame is a placeholder on paper: the crop's seed-pod motif
 * (/ornaments/motif-<key>.webp, from lib/data/pod-ornaments.ts by plantSlug) when the crop has
 * pod art, otherwise the theme's divider-stem motif. Both are decorative (alt="", aria-hidden):
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
              src={motif}
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
  const w480 = m.url.replace("/artwork/", "/artwork/w480/");
  const w768 = m.url.replace("/artwork/", "/artwork/w768/");
  const cardSrc = isVarietyArtwork ? w480 : m.url;
  const srcSet = isVarietyArtwork ? `${w480} 480w, ${w768} 768w` : undefined;
  return (
    <div className="card-image mb-2 aspect-[1/2] w-full overflow-hidden rounded-lg bg-paper" data-testid="variety-card-image">
      {/* A plain <img>: the files are fixed-size local assets, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cardSrc}
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
