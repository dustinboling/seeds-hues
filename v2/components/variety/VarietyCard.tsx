import Link from "next/link";
import { VarietyCardImage } from "@/components/variety/VarietyCardImage";
import { plural, shortCommonName } from "@/lib/format";
import type { VarietyListItem } from "@/lib/validators";

/**
 * Variety card, on the crop-card anatomy (app/page.tsx "Browse by crop"): the whole card is one
 * link to /variety/{slug}. Top to bottom: the variety illustration shown WHOLE on paper in a 1:2
 * frame (VarietyCardImage; without media, the crop's pod motif or the divider-stem placeholder),
 * the mini stem, then a fixed-height name zone at the BOTTOM holding the name, one muted crop line and one
 * availability line ("No sellers yet" or "N farms"). Nothing else: no swatch, no latin eyebrow,
 * no stock counts, no "Last checked", no credits, no prices. Fixed-aspect art + fixed name zone +
 * full-height link keep every card in a row the same height. No per-card heading: the page's own
 * headings structure the grid.
 */
export function VarietyCard({ v }: { v: VarietyListItem }) {
  const crop = shortCommonName(v.plant.commonName);
  return (
    <Link
      href={`/variety/${v.slug}`}
      aria-label={`${v.varietyName} — ${crop}`}
      className="card card-hover packet tap flex h-full flex-col items-center p-4 text-center no-underline"
    >
      <span className="block w-full">
        <VarietyCardImage media={v.media} varietyName={v.varietyName} plantSlug={v.plant.slug} />
      </span>
      <span aria-hidden="true" className="divider-stem-mini mt-1" />
      <span className="flex h-[6.25rem] flex-col items-center justify-center gap-0.5">
        <span className="line-clamp-2 font-display text-lg font-semibold leading-snug text-ink">{v.varietyName}</span>
        <span className="text-sm text-muted">{crop}</span>
        <span className="text-sm text-muted">{v.listingCount === 0 ? "No sellers yet" : plural(v.listingCount, "farm")}</span>
      </span>
    </Link>
  );
}

/** `wide` adds one column at the sm and lg breakpoints only (mobile stays at 2); used only by the /variety browse page. */
export function VarietyGrid({ items, wide = false }: { items: VarietyListItem[]; wide?: boolean }) {
  return (
    <ul
      className={
        wide ? "grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5" : "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4"
      }
    >
      {items.map((v) => (
        <li key={v.slug} className="h-full">
          <VarietyCard v={v} />
        </li>
      ))}
    </ul>
  );
}
