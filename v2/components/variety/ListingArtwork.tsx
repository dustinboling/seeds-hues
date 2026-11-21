import { podArtForPlant } from "@/lib/data/pod-ornaments";
import { imageUrl } from "@/lib/images";
import type { Media } from "@/lib/validators";

/**
 * Seller-listing artwork rail (seller context of ListingRow only): the fixed 1:2 plate mount
 * beside the card's text column. Resolves four tiers, first hit wins — the variety's own first
 * plate, the crop's first plate (Elena's rule), the crop's seed-pod motif, the divider-stem
 * placeholder. Plates render whole (contain-fit on the paper ground, our own image CDN through
 * lib/images — never cropped, never hotlinked); the fixed aspect reserves the box before the
 * file arrives, so the list has no layout shift. Not a link, not interactive: the variety-name
 * heading beside it is the card's variety link, and the artwork carries no motion of its own.
 *
 * Alt text says what the image actually is: the variety plate is labelled with the variety
 * name, the crop plate with the crop's common name; motif and stem are decorative (alt="",
 * aria-hidden) — never a broken image, a stock photo or a guessed painting of the variety.
 */
export function ListingArtwork({
  media,
  cropMedia,
  varietyName,
  commonName,
  plantSlug,
}: {
  media: Media[];
  cropMedia: Media[];
  varietyName: string;
  commonName: string;
  plantSlug: string;
}) {
  const varietyPlate = media[0];
  const plate = varietyPlate ?? cropMedia[0];
  if (plate) {
    return (
      <div className="aspect-[1/2] w-18 shrink-0 self-start overflow-hidden rounded-lg border border-line bg-paper sm:w-24">
        {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(plate.url, { width: 480 })}
          alt={varietyPlate ? `${varietyName} — illustration` : `${commonName} — illustration`}
          width={480}
          height={960}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-contain"
        />
      </div>
    );
  }
  const motif = podArtForPlant(plantSlug)?.motif;
  if (motif) {
    return (
      <div className="flex aspect-[1/2] w-18 shrink-0 items-center justify-center self-start overflow-hidden rounded-lg border border-line bg-paper sm:w-24">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(motif, { width: 480 })}
          alt=""
          aria-hidden="true"
          width={480}
          height={480}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-3 opacity-90 sm:p-4"
        />
      </div>
    );
  }
  return (
    <div className="flex aspect-[1/2] w-18 shrink-0 items-center justify-center self-start overflow-hidden rounded-lg border border-line bg-paper sm:w-24">
      <span aria-hidden="true" className="divider-stem w-full opacity-50" />
    </div>
  );
}
