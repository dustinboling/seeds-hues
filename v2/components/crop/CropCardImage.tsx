import type { Media } from "@/lib/validators";

/**
 * Card thumbnail for a crop (home "Browse by crop" grid and the /crop index): the first own-work
 * media row, served from this app's own /artwork/crops/thumbs/ assets (never the full-size hero,
 * never a hotlink). Renders nothing when the crop has no media, so those cards stay as they were.
 * The frame is exactly the illustration standard's 1:2 aspect with contain-fit on paper, so the
 * FULL illustration always shows — the old 4:5 cover frame cropped the top and bottom of every
 * portrait (owner-reported 2026-11-16). The fixed aspect reserves the space before the file
 * arrives, so the grid has no layout shift.
 */
export function CropCardImage({ media, commonName }: { media: Media[]; commonName: string }) {
  const m = media[0];
  if (!m) return null;
  return (
    <div className="card-image mb-2 aspect-[1/2] w-full overflow-hidden rounded-lg bg-paper" data-testid="crop-card-image">
      {/* A plain <img>: the file is a fixed-size local asset, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.thumbUrl ?? m.url}
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
