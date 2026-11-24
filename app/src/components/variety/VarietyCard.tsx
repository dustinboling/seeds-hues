import { plural, shortCommonName } from "../../lib/format";
import { ZERO_SELLER_SHORT } from "../../lib/zero-seller";
import type { ApiVarietyListItem } from "../../data/types";
import { VarietyCardImage } from "./VarietyCardImage";

/**
 * The variety card, browse context (every grid outside shops): the whole
 * card is one link to /variety/{slug} with the shipped accessible name,
 * the seller-count line, no per-card heading. Ported from
 * v2/components/variety/VarietyCard.tsx. The shop context (Slice 5's grid)
 * is not ported here — it lands with the seller shop page.
 *
 * The Latin line takes its slot — the payload's plant.latinName verbatim
 * and whole, or no node at all when null (absence is elemental: no
 * placeholder, no empty element, no reserved slot).
 */

/** The Latin line: verbatim stored string, or no node at all when null. */
function LatinLine({ latinName }: { latinName: string | null }) {
  if (latinName === null) return null;
  return (
    <span className="variety-card-latin">
      <i>{latinName}</i>
    </span>
  );
}

export function VarietyCard({ v }: { v: ApiVarietyListItem }) {
  const crop = shortCommonName(v.plant.commonName);
  return (
    <a href={`/variety/${v.slug}`} aria-label={`${v.varietyName} — ${crop}`} className="card card-hover variety-card">
      <span className="variety-card-art">
        <VarietyCardImage
          media={v.media}
          cropMedia={v.cropMedia}
          varietyName={v.varietyName}
          cropName={v.plant.commonName}
          plantSlug={v.plant.slug}
        />
      </span>
      <span className="variety-card-text">
        <LatinLine latinName={v.plant.latinName} />
        <span className="variety-card-name">{v.varietyName}</span>
        <span className="variety-card-crop">{crop}</span>
        <span className="variety-card-sellers">{v.sellerCount === 0 ? ZERO_SELLER_SHORT : plural(v.sellerCount, "seller")}</span>
      </span>
    </a>
  );
}

/** `wide` adds one column at the sm and lg breakpoints only (mobile stays at 2); used only by the /variety browse page. */
export function VarietyGrid({ items, wide = false }: { items: ApiVarietyListItem[]; wide?: boolean }) {
  return (
    <ul className={`variety-grid${wide ? " variety-grid-wide" : ""}`}>
      {items.map((v) => (
        <li key={v.slug} className="variety-grid-item">
          <VarietyCard v={v} />
        </li>
      ))}
    </ul>
  );
}
