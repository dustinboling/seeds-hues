/**
 * Life-cycle filter buckets: which of Annual / Biennial / Perennial a
 * crop's life_cycle text puts it in. Ported verbatim from
 * v2/lib/life-cycle.ts (same grammar, same order) — the query layer, the
 * read-side browse predicates, and the tests share this one function.
 *
 * The bucket follows HOW THE PLANT IS GROWN, not its botany: a "grown
 * as …" qualifier decides alone; otherwise every habit the text names
 * counts. Text the grammar does not recognise gets NO bucket ([]).
 */
import type { LifeCycleParam } from "./browse";

const HABIT = "(annual|biennial|perennial)";
/** e.g. "hardy annual", "tender short-lived perennial", "biennial to short-lived perennial". */
const BASE = `(?:(?:hardy|half-hardy|tender) )?(?:short-lived )?${HABIT}(?: (?:or|to) (?:short-lived )?${HABIT})?`;
/** e.g. ", usually grown as an annual", ", often grown as a biennial or annual". */
const GROWN_AS = `, (?:usually |often |most often )?grown as (?:an? )?${HABIT}(?: or (?:an? )?${HABIT})?`;
const GRAMMAR = new RegExp(`^${BASE}(?:${GROWN_AS})?$`);

const BUCKETS: readonly LifeCycleParam[] = ["annual", "biennial", "perennial"];

/** Buckets for one life_cycle value, in canonical order; [] when absent or unrecognised. */
export function lifeCycleBuckets(lifeCycle: string | null | undefined): LifeCycleParam[] {
  const text = lifeCycle?.trim().toLowerCase().replace(/\s+/g, " ");
  if (!text) return [];
  const m = GRAMMAR.exec(text);
  if (!m) return [];
  const [, base1, base2, grown1, grown2] = m;
  const named = grown1 ? [grown1, grown2] : [base1, base2];
  return BUCKETS.filter((b) => named.includes(b));
}

/** True when the life_cycle value falls in ANY of the given buckets. */
export function lifeCycleMatches(lifeCycle: string | null | undefined, buckets: readonly LifeCycleParam[]): boolean {
  return lifeCycleBuckets(lifeCycle).some((b) => buckets.includes(b));
}
