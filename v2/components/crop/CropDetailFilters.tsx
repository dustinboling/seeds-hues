import Link from "next/link";
import type { RefObject } from "react";
import { FilterStrip } from "@/components/ui/FilterStrip";
import { SwatchDot } from "@/components/ui/BrowseFilters";
import {
  CROP_DETAIL_GROUPS,
  CROP_DETAIL_LEGENDS,
  CROP_SELLERS_LABELS,
  cropChipHref,
  cropCountFor,
  cropHueLabel,
  isCropOptionActive,
  type CropDetailFilterState,
  type CropDetailGroup,
  type CropHue,
} from "@/lib/crop-detail";
import type { CropDetailCounts, SeriesRef } from "@/lib/validators";

/**
 * The per-option count inside a crop chip — the BrowseFilters ChipCount pattern for this
 * surface's counts shape, shared with the hydrated buttons so the two can never drift.
 * Sighted readers see the parenthesized numeral; assistive tech gets the numeral plus the
 * unit ("12 varieties"). The visible parens are aria-hidden so the accessible name reads
 * exactly "7 varieties".
 */
export function CropChipCount({
  counts,
  group,
  value,
}: {
  counts: CropDetailCounts;
  group: CropDetailGroup;
  value: string | null;
}) {
  const n = cropCountFor(counts, group, value);
  return (
    <span className="text-muted tabular-nums">
      <span aria-hidden="true">({n})</span>
      <span className="sr-only">
        {n} varieties
      </span>
    </span>
  );
}

/** One group's chips: "All" plus every option, in display order (hue in canonical order). */
function groupOptions(
  g: CropDetailGroup,
  opts: { hues: CropHue[]; series: SeriesRef[] },
): { value: string | null; label: string; hue?: CropHue }[] {
  if (g === "sellers") {
    return [
      { value: null, label: "All" },
      { value: "true", label: CROP_SELLERS_LABELS.has },
      { value: "false", label: CROP_SELLERS_LABELS.none },
    ];
  }
  if (g === "hue") {
    return [{ value: null, label: "All" }, ...opts.hues.map((h) => ({ value: h as string, label: cropHueLabel(h), hue: h }))];
  }
  return [{ value: null, label: "All" }, ...opts.series.map((s) => ({ value: s.slug, label: s.name }))];
}

/** The groups a crop renders: the settled order, minus Series when the crop has none. */
export function cropDetailGroups(series: SeriesRef[]): CropDetailGroup[] {
  return CROP_DETAIL_GROUPS.filter((g) => g !== "series" || series.length > 0);
}

/**
 * Crop-detail filters (Tranche 3.1b-2): one fieldset per group — Sellers, Hue, Series — with
 * the eyebrow legends (register B-3), hue swatch dots, and per-option counts. Chips are plain
 * server-rendered links; groups combine: every chip keeps the other groups' active values.
 * The active chip carries aria-current="true", so the state is announced, not only shown by
 * color. Hue is multi-select (PB-2): "All" clears the set. A 0-count option renders its 0
 * and stays operable. Season / Sowing method / Life cycle stay header facts, never filters.
 */
export function CropDetailFilters({
  basePath,
  state,
  counts,
  hues,
  series,
}: {
  basePath: string;
  state: CropDetailFilterState;
  counts: CropDetailCounts;
  hues: CropHue[];
  series: SeriesRef[];
}) {
  return (
    <nav aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {cropDetailGroups(series).map((g) => {
        const items = groupOptions(g, { hues, series }).map((o) => {
          const active = isCropOptionActive(state, g, o.value);
          return (
            <li key={o.value ?? "all"} className="flex-none">
              <Link
                href={cropChipHref(basePath, state, g, o.value)}
                scroll={false}
                className="chip-filter"
                aria-current={active ? "true" : undefined}
                data-filter={g}
              >
                {o.hue && o.hue !== "unknown" ? <SwatchDot family={o.hue} /> : null}
                {o.label} <CropChipCount counts={counts} group={g} value={o.value} />
              </Link>
            </li>
          );
        });
        return (
          <fieldset key={g} className="min-w-0">
            <legend className="eyebrow mb-1">{CROP_DETAIL_LEGENDS[g]}</legend>
            <FilterStrip legend={CROP_DETAIL_LEGENDS[g]}>{items}</FilterStrip>
          </fieldset>
        );
      })}
    </nav>
  );
}

/**
 * The hydrated crop-detail filter block: toggle buttons with aria-pressed (independent
 * toggles for Hue) — stable keys, so state changes update pressed state and counts without
 * remounting any chip. Rendered by CropDetailBrowse after hydration; the server floor above
 * renders before it.
 */
export function CropDetailFilterButtons({
  state,
  counts,
  hues,
  series,
  groups,
  onSelect,
  firstAllRef,
}: {
  state: CropDetailFilterState;
  counts: CropDetailCounts;
  hues: CropHue[];
  series: SeriesRef[];
  groups: CropDetailGroup[];
  onSelect: (group: CropDetailGroup, value: string | null) => void;
  firstAllRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <div role="group" aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {groups.map((g) => (
        <fieldset key={g} className="min-w-0">
          <legend className="eyebrow mb-1">{CROP_DETAIL_LEGENDS[g]}</legend>
          <FilterStrip legend={CROP_DETAIL_LEGENDS[g]}>
            {groupOptions(g, { hues, series }).map((o) => (
              <li key={o.value ?? "all"} className="flex-none">
                <button
                  ref={g === groups[0] && o.value === null ? firstAllRef : undefined}
                  type="button"
                  className="chip-filter"
                  aria-pressed={isCropOptionActive(state, g, o.value)}
                  data-filter={g}
                  onClick={() => onSelect(g, o.value)}
                >
                  {o.hue && o.hue !== "unknown" ? <SwatchDot family={o.hue} /> : null}
                  {o.label} <CropChipCount counts={counts} group={g} value={o.value} />
                </button>
              </li>
            ))}
          </FilterStrip>
        </fieldset>
      ))}
    </div>
  );
}
