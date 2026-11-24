import { imageSrcSet, imageUrl } from "../lib/images";

/**
 * Homepage hero→browse break: the C3 — Vine & Pods, Revised (love-in-a-puff)
 * motif, the same R2 asset the live site uses (stored /theme/divider-home.webp,
 * rendered through lib/images as 720/1080/1440-wide scale-down
 * transformations from our own image CDN). The 2400×365 intrinsic attributes
 * reserve the box before the file arrives (no layout shift); the .divider-home
 * class caps the rendered width at 640px. Decorative (figure aria-hidden,
 * empty alt), lazy/async, no priority.
 */
export function HomeMotifDivider() {
  return (
    <figure aria-hidden="true" data-testid="home-motif" className="divider-home home-motif">
      {/* A plain <img>: sizing is done by the image CDN's transformations. */}
      {/* No display class: .divider-home img provides display/width/height, and a
          display utility would beat the forced-colors hide rule. */}
      <img
        src={imageUrl("/theme/divider-home.webp", { width: 1440 })}
        srcSet={imageSrcSet("/theme/divider-home.webp", [720, 1080, 1440])}
        sizes="(min-width: 672px) 640px, calc(100vw - 32px)"
        alt=""
        width={2400}
        height={365}
        loading="lazy"
        decoding="async"
      />
    </figure>
  );
}
