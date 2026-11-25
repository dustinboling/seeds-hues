import type { StatePlateArt } from "../../lib/state-plates";
import { imageUrl } from "../../lib/images";

/**
 * A state's official-flower plate, shared by the seller page (beside the
 * farm summary) and the state page (directly above the farm list).
 * Informative, not decorative: the alt is the only text that names the
 * flower. Ported from v2's StatePlate.
 *
 * Shown whole in the existing .art-frame (no crop utility; lib/images is
 * fit=scale-down only), as a 640-wide transformation for a ≤ 320 CSS px
 * display (2× DPR, no srcset). width/height 1600 are the real pixel size,
 * reserving the 1:1 box so neither eager nor lazy loading shifts layout.
 * No caption, no title, no aria-label, no link, no hover: identification,
 * not navigation. fetchPriority is never set. The caller decides whether
 * a plate exists; this component assumes a valid table entry.
 */
export function StatePlate({
  code,
  plate,
  loading,
  className = "state-plate state-plate-seller",
}: {
  /** USPS state code, for the data-state-plate verification hook. */
  code: string;
  plate: StatePlateArt;
  /** Seller page: "eager" (first viewport, no hero). State page: "lazy" (below the eager hero). */
  loading: "eager" | "lazy";
  /**
   * The figure's placement classes (width + margins) for the caller's
   * slot; the plate's size is the same in every slot. Defaults to the
   * seller-page beside-the-summary placement; the state page passes its
   * above-the-farm-list placement. Every other markup invariant is fixed
   * by this component and not caller-adjustable.
   */
  className?: string;
}) {
  return (
    <figure className={className} data-state-plate={code}>
      {/* A plain <img>: a 640-wide scale-down transformation from our own image CDN (lib/images). */}
      <img
        src={imageUrl(plate.path, { width: 640 })}
        alt={plate.alt}
        width={1600}
        height={1600}
        loading={loading}
        decoding="async"
        className="art-frame state-plate-img"
      />
    </figure>
  );
}
