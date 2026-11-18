import { imageUrl } from "@/lib/images";

/**
 * Decorative horizontal seed-pod scene (stored path /ornaments/bundle-<key>.webp from
 * lib/data/pod-ornaments.ts, rendered through lib/images as a 1600-wide (1600×400) scale-down
 * transformation from our own image CDN) used as a section divider. aria-hidden, empty alt, no
 * caption.
 */
export function PodDivider({ bundle, className }: { bundle: string; className?: string }) {
  return (
    <div aria-hidden="true" data-testid="pod-divider" className={["w-full", className].filter(Boolean).join(" ")}>
      {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl(bundle, { width: 1600 })} alt="" width={1600} height={400} loading="lazy" decoding="async" className="h-auto w-full" />
    </div>
  );
}
