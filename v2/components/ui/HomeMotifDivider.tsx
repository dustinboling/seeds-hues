import { imageSrcSet, imageUrl } from "@/lib/images";

/**
 * Homepage hero→browse break: the C3 — Vine & Pods, Revised (love-in-a-puff) motif
 * (approved by Dustin 2026-11-22; replaces the thin-stem rule at this break only — every
 * other stem instance keeps .divider-stem). Stored /theme/divider-home.webp, rendered through
 * lib/images as 720/1080/1440-wide scale-down transformations from our own image CDN.
 * The 2400×365 intrinsic attributes reserve the box before the file arrives (no layout
 * shift); the .divider-home class caps the rendered width at the size.divider-home token
 * (640px). Decorative (figure aria-hidden, empty alt), lazy/async, no priority.
 */
export function HomeMotifDivider() {
  return (
    <figure aria-hidden="true" data-testid="home-motif" className="divider-home mb-8 mt-10">
      {/* A plain <img>: sizing is done by the image CDN's transformations, so next/image adds nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl("/theme/divider-home.webp", { width: 1440 })}
        srcSet={imageSrcSet("/theme/divider-home.webp", [720, 1080, 1440])}
        sizes="(min-width: 672px) 640px, calc(100vw - 32px)"
        alt=""
        width={2400}
        height={365}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
    </figure>
  );
}
