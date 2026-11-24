import { imageUrl } from "../lib/images";

/**
 * Card thumbnail for a crop (home "Browse by crop" grid and the /crop index):
 * the first own-work media row as a 480-wide scale-down transformation from
 * our own image CDN. Renders nothing when the crop has no media. The frame is
 * exactly the illustration standard's 1:2 aspect with contain-fit on paper, so
 * the FULL illustration always shows; the fixed aspect reserves the space
 * before the file arrives (no layout shift).
 */
export function CropCardImage({ media, commonName }: { media: { url: string }[]; commonName: string }) {
  const m = media[0];
  if (!m) return null;
  return (
    <div className="card-image crop-card-image" data-testid="crop-card-image">
      {/* A plain <img>: sizing is done by the image CDN's transformations. */}
      <img
        src={imageUrl(m.url, { width: 480 })}
        alt={`${commonName} — illustration`}
        width={480}
        height={960}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}
