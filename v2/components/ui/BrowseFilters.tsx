import Link from "next/link";
import { FilterStrip } from "@/components/ui/FilterStrip";
import { SmallFarmLegend } from "@/components/seller/SmallFarmBadge";
import { MIX_GRADIENT } from "@/lib/color-chip";
import {
  BROWSE_OPTIONS,
  chipHref,
  COLOR_FAMILY_SWATCHES,
  countFor,
  isOptionActive,
  type BrowseFilterGroup,
  type BrowseFilterState,
  type ColorFamily,
  type HueMode,
} from "@/lib/browse";
import type { BrowseCounts } from "@/lib/validators";

export function SwatchDot({ family }: { family: ColorFamily }) {
  // Mixed draws the shared conic gradient (there is no single hex for it).
  const hex = COLOR_FAMILY_SWATCHES[family];
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
      style={hex ? { backgroundColor: hex } : { backgroundImage: MIX_GRADIENT }}
    />
  );
}

/**
 * The per-option count inside a chip — shared with the hydrated buttons so the two can never
 * drift. Sighted readers see the parenthesized numeral; assistive tech gets the numeral plus
 * this surface's unit (§2.4.2: "12 varieties"), generalizing the shipped StateFilter pattern.
 * The visible parens are aria-hidden so the accessible name reads exactly "7 varieties" (or
 * "7 crops", "7 results" — the unit is per surface, so crops are never announced as varieties).
 */
export function ChipCount({
  counts,
  group,
  value,
  unit = "varieties",
}: {
  counts: BrowseCounts;
  group: BrowseFilterGroup;
  value: string | null;
  unit?: string;
}) {
  const n = countFor(counts, group, value);
  return (
    <span className="text-muted tabular-nums">
      <span aria-hidden="true">({n})</span>
      <span className="sr-only">
        {n} {unit}
      </span>
    </span>
  );
}

/**
 * Browse filters: one fieldset per group — Season, Sowing method and, on variety lists, Life
 * cycle (on /variety), Hue and Sellers (on /variety; followed by the Small farm badge legend). Chips are plain server-rendered links; groups combine: every chip
 * keeps the other groups' active values. The active chip carries aria-current="true", so the state
 * is announced, not only shown by color; hue chips pair the swatch dot with a text label.
 * Every group is a single-line, horizontally scrollable strip (FilterStrip, a small client
 * component) — no wrapping anywhere. Rows swipe sideways on narrow screens, with left/right edge
 * fades showing which side has more chips; on fine-pointer (mouse/trackpad) devices, chevron
 * buttons also scroll the row.
 *
 * Hue mode (Tranche 3.1a, PB-2): "multi" on /variety — independent toggles, "All" clearing the
 * set; "single" everywhere else, today's behavior exactly. Counts: when provided, every chip
 * carries its per-option count in parentheses — a 0-count option renders its 0 and stays
 * operable. The count unit is per surface ("varieties", "crops", "results"), so the sr-only
 * form always names what the surface lists.
 */
export function BrowseFilters({
  basePath,
  state,
  groups,
  params = {},
  hueMode = "single",
  counts = null,
  unit = "varieties",
}: {
  basePath: string;
  state: BrowseFilterState;
  groups: BrowseFilterGroup[];
  params?: Record<string, string>;
  hueMode?: HueMode;
  counts?: BrowseCounts | null;
  unit?: string;
}) {
  return (
    <nav aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {groups.map((g) => {
        const items = BROWSE_OPTIONS[g].options.map((o) => {
          const active = isOptionActive(state, g, o.value, hueMode);
          return (
            <li key={o.value ?? "all"} className="flex-none">
              <Link
                href={chipHref(basePath, state, g, o.value, params, hueMode)}
                scroll={false}
                className="chip-filter"
                aria-current={active ? "true" : undefined}
                data-filter={g}
              >
                {o.hue ? <SwatchDot family={o.hue} /> : null}
                {o.label}
                {counts ? (
                  <>
                    {" "}
                    <ChipCount counts={counts} group={g} value={o.value} unit={unit} />
                  </>
                ) : null}
              </Link>
            </li>
          );
        });
        return (
          <fieldset key={g} className="min-w-0">
            <legend className="eyebrow mb-1">{BROWSE_OPTIONS[g].legend}</legend>
            <FilterStrip legend={BROWSE_OPTIONS[g].legend}>{items}</FilterStrip>
            {/* The page's one legend line (ux-spec §5.1): directly under the Sellers strip. */}
            {g === "smallFarm" ? <SmallFarmLegend className="mt-1" /> : null}
          </fieldset>
        );
      })}
    </nav>
  );
}
