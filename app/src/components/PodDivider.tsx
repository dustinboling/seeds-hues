import { imageUrl } from "../lib/images";

/**
 * Decorative horizontal seed-pod scene (stored path /ornaments/bundle-<key>.webp,
 * rendered through lib/images as a 1600-wide (1600×400) scale-down
 * transformation from our own image CDN) used as a section divider.
 * aria-hidden, empty alt, no caption.
 */
export function PodDivider({ bundle, className }: { bundle: string; className?: string }) {
  return (
    <div aria-hidden="true" data-testid="pod-divider" className={["pod-divider", className].filter(Boolean).join(" ")}>
      {/* A plain <img>: sizing is done by the image CDN's transformations. */}
      <img src={imageUrl(bundle, { width: 1600 })} alt="" width={1600} height={400} loading="lazy" decoding="async" />
    </div>
  );
}
