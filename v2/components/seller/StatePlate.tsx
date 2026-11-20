import type { StatePlateArt } from "@/lib/data/state-plates";
import { imageUrl } from "@/lib/images";

/**
 * A state's official-flower plate (state-plates placement spec, 2026-11-19), shared by the seller
 * page (beside the farm summary) and the state page (directly above the farm list — placement
 * amended by Dustin's call 2026-11-20, Elena's B-05). Informative, not decorative: the alt
 * (lib/data/state-plates.ts, spec §A.2) is the only text that names the flower.
 *
 * Shown whole in the existing .art-frame (no crop utility; lib/images is fit=scale-down only), as
 * a 640-wide transformation for a ≤ 320 CSS px display (2× DPR, no srcset). width/height 1600 are
 * the real pixel size, reserving the 1:1 box so neither eager nor lazy loading shifts layout.
 * No caption, no title, no aria-label, no link, no hover: identification, not navigation (§1.4,
 * §1.5, §A.3). fetchPriority is never set (§A.5.3). The caller decides whether a plate exists; this
 * component assumes a valid table entry.
 */
export function StatePlate({
  code,
  plate,
  loading,
  className = "mx-auto mt-6 w-[280px] shrink-0 sm:mx-0 sm:mt-1 sm:w-[300px] lg:w-[320px]",
}: {
  /** USPS state code, for the data-state-plate verification hook. */
  code: string;
  plate: StatePlateArt;
  /** Seller page: "eager" (first viewport, no hero). State page: "lazy" (below the eager hero). */
  loading: "eager" | "lazy";
  /**
   * The figure's placement classes (width + margins) for the caller's slot; the plate's size is
   * the same in every slot. Defaults to the seller-page beside-the-summary placement; the state
   * page passes its above-the-farm-list placement. Every other markup invariant (§1.3–1.5, §A.3,
   * §A.5) is fixed by this component and not caller-adjustable.
   */
  className?: string;
}) {
  return (
    <figure className={className} data-state-plate={code}>
      {/* A plain <img>: a 640-wide scale-down transformation from our own image CDN (lib/images). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl(plate.path, { width: 640 })}
        alt={plate.alt}
        width={1600}
        height={1600}
        loading={loading}
        decoding="async"
        className="art-frame h-auto w-full"
      />
    </figure>
  );
}
