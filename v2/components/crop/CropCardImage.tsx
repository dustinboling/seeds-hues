import { imageUrl } from "@/lib/images";
import type { Media } from "@/lib/validators";

/**
 * Card thumbnail for a crop (home "Browse by crop" grid and the /crop index): the first own-work
 * media row as a 480-wide scale-down transformation from our own image CDN (lib/images; migrated
 * 2026-11-18 — the old pre-generated /artwork/crops/thumbs/ copies are gone; never the full-size
 * hero, never a hotlink). Renders nothing when the crop has no media, so those cards stay as they
 * were. The frame is exactly the illustration standard's 1:2 aspect with contain-fit on paper, so
 * the FULL illustration always shows — the old 4:5 cover frame cropped the top and bottom of every
 * portrait (owner-reported 2026-11-16). The fixed aspect reserves the space before the file
 * arrives, so the grid has no layout shift.
 */
export function CropCardImage({ media, commonName }: { media: Media[]; commonName: string }) {
  const m = media[0];
  if (!m) return null;
  return (
    <div className="card-image mb-2 aspect-[1/2] w-full overflow-hidden rounded-inner bg-paper" data-testid="crop-card-image">
      {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(m.url, { width: 480 })}
        alt={`${commonName} — illustration`}
        width={480}
        height={960}
        loading="lazy"
        decoding="async"
        className="block h-full w-full object-contain"
      />
    </div>
  );
}
