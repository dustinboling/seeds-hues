/**
 * Crop-detail filters: one fieldset per group — Sellers, Hue, Series —
 * with the eyebrow legends, hue swatch dots, and per-option counts. Chips
 * are plain server-rendered links (hydrated: toggle buttons); groups
 * combine: every chip keeps the other groups' active values. The active
 * chip carries aria-current="true", so the state is announced, not only
 * shown by color. Hue is multi-select: "All" clears the set. A 0-count
 * option renders its 0 and stays operable. Season / Sowing method / Life
 * cycle stay header facts, never filters. Ported from v2's
 * CropDetailFilters (+ the hydrated buttons).
 */
import { SwatchDot } from "../browse/BrowseFilters";
import { FilterStrip } from "../browse/FilterStrip";
import type { InPlaceNav } from "../browse/InPlaceNav";
import type { ApiCropDetailCounts, ApiSeriesRef } from "../../data/types";
import {
  CROP_DETAIL_GROUPS,
  CROP_DETAIL_LEGENDS,
  CROP_SELLERS_LABELS,
  cropChipHref,
  cropCountFor,
  cropCountStateFor,
  cropHueLabel,
  isCropOptionActive,
  type CropDetailFilterState,
  type CropDetailGroup,
  type CropHue,
} from "../../lib/crop-detail";

/**
 * The per-option count inside a crop chip. Sighted readers see the
 * parenthesized numeral; assistive tech gets the numeral plus the unit
 * ("12 varieties"). The visible parens are aria-hidden so the accessible
 * name reads exactly "7 varieties".
 */
export function CropChipCount({
  counts,
  group,
  value,
}: {
  counts: ApiCropDetailCounts;
  group: CropDetailGroup;
  value: string | null;
}) {
  const n = cropCountFor(counts, group, value);
  return (
    <span className="browse-chip-count">
      <span aria-hidden="true">({n})</span>
      <span className="sr-only">{n} varieties</span>
    </span>
  );
}

/** One group's chips: "All" plus every option, in display order (hue in canonical order). */
function groupOptions(
  g: CropDetailGroup,
  opts: { hues: CropHue[]; series: ApiSeriesRef[] },
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
export function cropDetailGroups(series: ApiSeriesRef[]): CropDetailGroup[] {
  return CROP_DETAIL_GROUPS.filter((g) => g !== "series" || series.length > 0);
}

export function CropDetailFilters({
  basePath,
  state,
  counts,
  hues,
  series,
  browse,
}: {
  basePath: string;
  state: CropDetailFilterState;
  counts: ApiCropDetailCounts;
  hues: CropHue[];
  series: ApiSeriesRef[];
  /** Hydrated commit path (server floor renders links when absent). */
  browse?: InPlaceNav<CropDetailFilterState>;
}) {
  const hydrated = browse?.hydrated ?? false;
  const shown = browse?.shown ?? state;
  const groups = cropDetailGroups(series).map((g) => {
    const items = groupOptions(g, { hues, series }).map((o) => {
      const active = isCropOptionActive(shown, g, o.value);
      return (
        <li key={o.value ?? "all"} className="browse-chip-item">
          {hydrated && browse ? (
            <button
              type="button"
              className="chip-filter"
              aria-pressed={active}
              data-filter={g}
              onClick={() => browse.select((s) => cropCountStateFor(s, g, o.value))}
            >
              {o.hue && o.hue !== "unknown" ? <SwatchDot family={o.hue} /> : null}
              {o.label} <CropChipCount counts={counts} group={g} value={o.value} />
            </button>
          ) : (
            <a
              href={cropChipHref(basePath, state, g, o.value)}
              className="chip-filter"
              aria-current={active ? "true" : undefined}
              data-filter={g}
              data-vike="false"
            >
              {o.hue && o.hue !== "unknown" ? <SwatchDot family={o.hue} /> : null}
              {o.label} <CropChipCount counts={counts} group={g} value={o.value} />
            </a>
          )}
        </li>
      );
    });
    return (
      <fieldset key={g} className="browse-filter-group">
        <legend className="eyebrow">{CROP_DETAIL_LEGENDS[g]}</legend>
        <FilterStrip legend={CROP_DETAIL_LEGENDS[g]}>{items}</FilterStrip>
      </fieldset>
    );
  });
  return hydrated ? (
    <div role="group" aria-label="Filters" className="browse-filters">
      {groups}
    </div>
  ) : (
    <nav aria-label="Filters" className="browse-filters">
      {groups}
    </nav>
  );
}
