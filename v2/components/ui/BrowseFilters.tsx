import Link from "next/link";
import { FilterStrip } from "@/components/ui/FilterStrip";
import {
  COLOR_FAMILIES,
  COLOR_FAMILY_LABELS,
  COLOR_FAMILY_SWATCHES,
  LIFE_CYCLE_LABELS,
  LIFE_CYCLE_PARAMS,
  METHOD_PARAMS,
  SEASON_LABELS,
  SEASON_PARAMS,
  SOWING_METHOD_LABELS,
  type ColorFamily,
  type LifeCycleParam,
  type MethodParam,
  type SeasonParam,
} from "@/lib/validators";

/** The active browse filters. Each group is single-select; null = "All". */
export interface BrowseFilterState {
  season: SeasonParam | null;
  method: MethodParam | null;
  lifeCycle: LifeCycleParam | null;
  hue: ColorFamily | null;
}

export type BrowseFilterGroup = keyof BrowseFilterState;

/** Query-param name per group (the same names /api/v1 uses). */
const PARAM: Record<BrowseFilterGroup, string> = { season: "season", method: "method", lifeCycle: "life_cycle", hue: "color_family" };

/** The filter params to carry on links (e.g. Pagination) — only the active groups. */
export function filterParams(state: BrowseFilterState): Record<string, string> {
  const out: Record<string, string> = {};
  for (const g of Object.keys(PARAM) as BrowseFilterGroup[]) {
    const v = state[g];
    if (v) out[PARAM[g]] = v;
  }
  return out;
}

/** Labels of the active filters, in group order, for result-count lines ("48 crops · …"). */
export function activeFilterLabels(state: BrowseFilterState): string[] {
  return [
    state.season ? SEASON_LABELS[SEASON_PARAMS[state.season]] : null,
    state.method ? SOWING_METHOD_LABELS[METHOD_PARAMS[state.method]] : null,
    state.lifeCycle ? LIFE_CYCLE_LABELS[state.lifeCycle] : null,
    state.hue ? COLOR_FAMILY_LABELS[state.hue] : null,
  ].filter((x): x is string => x !== null);
}

/**
 * Link for one chip: the other groups' active values and the extra params (q on /search) are
 * kept; ?page= is never carried (a changed filter starts at page 1).
 */
function chipHref(
  basePath: string,
  state: BrowseFilterState,
  group: BrowseFilterGroup,
  value: string | null,
  params: Record<string, string>,
): string {
  const p = new URLSearchParams(params);
  p.delete("page");
  for (const [k, v] of Object.entries(filterParams({ ...state, [group]: value }))) p.set(k, v);
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** Mixed: a conic gradient through the family swatches (there is no single hex for it). */
const MIX_GRADIENT = `conic-gradient(${(["pink", "orange", "yellow", "green", "blue", "purple", "pink"] as const)
  .map((f) => COLOR_FAMILY_SWATCHES[f])
  .join(", ")})`;

function SwatchDot({ family }: { family: ColorFamily }) {
  const hex = COLOR_FAMILY_SWATCHES[family];
  return (
    <span
      aria-hidden="true"
      className="mr-1.5 inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-line-strong"
      style={hex ? { backgroundColor: hex } : { backgroundImage: MIX_GRADIENT }}
    />
  );
}

type Option = { value: string | null; label: string; hue?: ColorFamily };

const OPTIONS: Record<BrowseFilterGroup, { legend: string; options: Option[] }> = {
  season: {
    legend: "Season",
    options: [
      { value: null, label: "All" },
      ...(Object.keys(SEASON_PARAMS) as SeasonParam[]).map((k) => ({ value: k, label: SEASON_LABELS[SEASON_PARAMS[k]] })),
    ],
  },
  method: {
    legend: "Sowing method",
    options: [
      { value: null, label: "All" },
      ...(Object.keys(METHOD_PARAMS) as MethodParam[]).map((k) => ({ value: k, label: SOWING_METHOD_LABELS[METHOD_PARAMS[k]] })),
    ],
  },
  lifeCycle: {
    legend: "Life cycle",
    options: [{ value: null, label: "All" }, ...LIFE_CYCLE_PARAMS.map((k) => ({ value: k, label: LIFE_CYCLE_LABELS[k] }))],
  },
  hue: {
    legend: "Hue",
    options: [{ value: null, label: "All" }, ...COLOR_FAMILIES.map((f) => ({ value: f, label: COLOR_FAMILY_LABELS[f], hue: f }))],
  },
};

/**
 * Browse filters: one fieldset per group — Season, Sowing method and, on variety lists, Life
 * cycle (on /variety) and Hue. Chips are plain server-rendered links; groups combine: every chip
 * keeps the other groups' active values. The active chip carries aria-current="true", so the state
 * is announced, not only shown by colour; hue chips pair the swatch dot with a text label.
 * Every group is a single-line, horizontally scrollable strip (FilterStrip, a small client
 * component) — no wrapping anywhere. Rows swipe sideways on narrow screens, with left/right edge
 * fades showing which side has more chips; on fine-pointer (mouse/trackpad) devices, chevron
 * buttons also scroll the row.
 */
export function BrowseFilters({
  basePath,
  state,
  groups,
  params = {},
}: {
  basePath: string;
  state: BrowseFilterState;
  groups: BrowseFilterGroup[];
  params?: Record<string, string>;
}) {
  return (
    <nav aria-label="Filters" className="mt-4 flex flex-col gap-3">
      {groups.map((g) => {
        const items = OPTIONS[g].options.map((o) => {
          const active = o.value === state[g];
          return (
            <li key={o.value ?? "all"} className="flex-none">
              <Link
                href={chipHref(basePath, state, g, o.value, params)}
                scroll={false}
                className={`chip tap ${active ? "font-semibold" : ""}`}
                aria-current={active ? "true" : undefined}
                data-filter={g}
              >
                {o.hue ? <SwatchDot family={o.hue} /> : null}
                {o.label}
              </Link>
            </li>
          );
        });
        return (
          <fieldset key={g} className="min-w-0">
            <legend className="eyebrow mb-1">{OPTIONS[g].legend}</legend>
            <FilterStrip legend={OPTIONS[g].legend}>{items}</FilterStrip>
          </fieldset>
        );
      })}
    </nav>
  );
}
