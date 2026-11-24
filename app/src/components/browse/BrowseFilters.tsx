/**
 * Browse filters: one fieldset per group — ported from v2's
 * BrowseFilters.tsx + the InPlaceFilters hydration switch (same chips,
 * same counts, same legends; plain anchors instead of next/link).
 *
 * Before hydration the chips are plain server-rendered links (the no-JS
 * floor: the active chip carries aria-current="true"); after hydration
 * they are toggle buttons with aria-pressed. Chips keep stable keys, so
 * state changes update pressed state and counts without remounting any
 * chip — scroll never moves and focus stays on the tapped control. Counts
 * always follow the COMMITTED snapshot (results, counts, pagination, and
 * the count line follow committed only); chips show the optimistic state
 * while a change is in flight.
 */
import { SmallFarmLegend } from "../seller/SmallFarmBadge";
import {
  BROWSE_OPTIONS,
  COLOR_FAMILY_SWATCHES,
  chipHref,
  countFor,
  countStateFor,
  isOptionActive,
  type BrowseFilterGroup,
  type BrowseFilterState,
  type ColorFamily,
  type HueMode,
} from "../../lib/browse";
import { MIX_GRADIENT } from "../../lib/color-chip";
import type { ApiBrowseCounts } from "../../data/types";
import { FilterStrip } from "./FilterStrip";
import type { InPlaceNav } from "./InPlaceNav";

export function SwatchDot({ family }: { family: ColorFamily }) {
  // Mixed draws the shared conic gradient (there is no single hex for it).
  const hex = COLOR_FAMILY_SWATCHES[family];
  return (
    <span
      aria-hidden="true"
      className="swatch-dot"
      style={hex ? { backgroundColor: hex } : { backgroundImage: MIX_GRADIENT }}
    />
  );
}

/**
 * The per-option count inside a chip — shared with the hydrated buttons so
 * the two can never drift. Sighted readers see the parenthesized numeral;
 * assistive tech gets the numeral plus this surface's unit ("12
 * varieties"). The visible parens are aria-hidden so the accessible name
 * reads exactly "7 varieties" (the unit is per surface, so crops are never
 * announced as varieties).
 */
export function ChipCount({
  counts,
  group,
  value,
  unit = "varieties",
}: {
  counts: ApiBrowseCounts;
  group: BrowseFilterGroup;
  value: string | null;
  unit?: string;
}) {
  const n = countFor(counts, group, value);
  return (
    <span className="chip-count">
      <span aria-hidden="true">({n})</span>
      <span className="sr-only">
        {n} {unit}
      </span>
    </span>
  );
}

export function BrowseFilters({
  basePath,
  groups,
  params = {},
  hueMode = "single",
  counts,
  unit = "varieties",
  browse,
}: {
  basePath: string;
  groups: BrowseFilterGroup[];
  params?: Record<string, string>;
  hueMode?: HueMode;
  counts: ApiBrowseCounts;
  unit?: string;
  browse: InPlaceNav<BrowseFilterState>;
}) {
  const { hydrated, committed, shown, select, firstAllRef } = browse;
  if (!hydrated) {
    return (
      <nav aria-label="Filters" className="browse-filters">
        {groups.map((g) => (
          <fieldset key={g} className="browse-filter-group">
            <legend className="eyebrow">{BROWSE_OPTIONS[g].legend}</legend>
            <FilterStrip legend={BROWSE_OPTIONS[g].legend}>
              {BROWSE_OPTIONS[g].options.map((o) => {
                const active = isOptionActive(committed, g, o.value, hueMode);
                return (
                  <li key={o.value ?? "all"} className="browse-chip-item">
                    <a
                      href={chipHref(basePath, committed, g, o.value, params, hueMode)}
                      className="chip-filter"
                      aria-current={active ? "true" : undefined}
                      data-filter={g}
                      data-vike="false"
                    >
                      {o.hue ? <SwatchDot family={o.hue} /> : null}
                      {o.label} <ChipCount counts={counts} group={g} value={o.value} unit={unit} />
                    </a>
                  </li>
                );
              })}
            </FilterStrip>
            {/* The page's one legend line: directly under the Sellers strip. */}
            {g === "smallFarm" ? <SmallFarmLegend className="browse-legend" /> : null}
          </fieldset>
        ))}
      </nav>
    );
  }
  return (
    <div role="group" aria-label="Filters" className="browse-filters">
      {groups.map((g) => (
        <fieldset key={g} className="browse-filter-group">
          <legend className="eyebrow">{BROWSE_OPTIONS[g].legend}</legend>
          <FilterStrip legend={BROWSE_OPTIONS[g].legend}>
            {BROWSE_OPTIONS[g].options.map((o) => (
              <li key={o.value ?? "all"} className="browse-chip-item">
                <button
                  ref={g === groups[0] && o.value === null ? firstAllRef : undefined}
                  type="button"
                  className="chip-filter"
                  aria-pressed={isOptionActive(shown, g, o.value, hueMode)}
                  data-filter={g}
                  onClick={() => select((s) => countStateFor(s, g, o.value, hueMode))}
                >
                  {o.hue ? <SwatchDot family={o.hue} /> : null}
                  {o.label} <ChipCount counts={counts} group={g} value={o.value} unit={unit} />
                </button>
              </li>
            ))}
          </FilterStrip>
          {g === "smallFarm" ? <SmallFarmLegend className="browse-legend" /> : null}
        </fieldset>
      ))}
    </div>
  );
}
