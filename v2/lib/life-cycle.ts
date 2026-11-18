/**
 * Life-cycle filter buckets: which of Annual / Biennial / Perennial a crop's life_cycle text
 * puts it in. One pure function, shared by the catalog import check, the query layer and the
 * tests. The bucket follows HOW THE PLANT IS GROWN, not its botany:
 *  - a "grown as …" qualifier decides alone ("Tender perennial, grown as an annual" → Annual;
 *    "Short-lived perennial, often grown as a biennial or annual" → Annual + Biennial);
 *  - otherwise every habit the text names counts ("Annual or biennial" → Annual + Biennial,
 *    "Biennial or short-lived perennial" → Biennial + Perennial, "Hardy annual" → Annual).
 * The crop-page fact keeps the full wording; only the bucket is simplified.
 *
 * The grammar is strict: text it does not recognise gets NO bucket ([]), and the catalog import
 * rejects any plant whose life cycle has none (lib/catalog/assertions.ts), so new wording fails
 * loudly instead of silently dropping out of the filter.
 */
import { LIFE_CYCLE_PARAMS, type LifeCycleParam } from "@/lib/validators";

const HABIT = "(annual|biennial|perennial)";
/** e.g. "hardy annual", "tender short-lived perennial", "biennial to short-lived perennial". */
const BASE = `(?:(?:hardy|half-hardy|tender) )?(?:short-lived )?${HABIT}(?: (?:or|to) (?:short-lived )?${HABIT})?`;
/** e.g. ", usually grown as an annual", ", often grown as a biennial or annual". */
const GROWN_AS = `, (?:usually |often |most often )?grown as (?:an? )?${HABIT}(?: or (?:an? )?${HABIT})?`;
const GRAMMAR = new RegExp(`^${BASE}(?:${GROWN_AS})?$`);

/** Buckets for one life_cycle value, in canonical order; [] when absent or unrecognised. */
export function lifeCycleBuckets(lifeCycle: string | null | undefined): LifeCycleParam[] {
  const text = lifeCycle?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return [];
  const m = GRAMMAR.exec(text);
  if (!m) return [];
  const [, base1, base2, grown1, grown2] = m;
  const named = grown1 ? [grown1, grown2] : [base1, base2];
  return LIFE_CYCLE_PARAMS.filter((b) => named.includes(b));
}

/** True when the life_cycle value falls in ANY of the given buckets. */
export function lifeCycleMatches(lifeCycle: string | null | undefined, buckets: readonly LifeCycleParam[]): boolean {
  return lifeCycleBuckets(lifeCycle).some((b) => buckets.includes(b));
}
