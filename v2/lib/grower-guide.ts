/**
 * Crop-page grower guide: the header life-cycle fact and the tab set (pure functions, so the
 * page and the unit tests share one implementation). Content is shown as written; nothing is
 * filled in, and no source attribution exists in these shapes.
 */
import type { GrowerGuide } from "@/lib/validators";

/**
 * The one header fact combining life cycle + hardiness, e.g. "Perennial · Zones 3–8".
 * Only one present → that one. Neither → null (the line is not rendered).
 * When the hardiness text already opens by naming the life cycle (e.g. life cycle "Annual",
 * hardiness "Hardy annual — the foliage shrugs off light frosts."), the hardiness text alone is
 * the natural fact; repeating "Annual · Hardy annual — …" would say it twice.
 */
export function lifeCycleFact(lifeCycle: string | null | undefined, hardiness: string | null | undefined): string | null {
  const life = lifeCycle?.trim() || null;
  const hardy = hardiness?.trim() || null;
  if (life && hardy) return hardinessNamesLifeCycle(life, hardy) ? hardy : `${life} · ${hardy}`;
  return life ?? hardy;
}

/** True when the hardiness text's opening clause contains the life cycle as whole words. */
function hardinessNamesLifeCycle(life: string, hardy: string): boolean {
  const lead = hardy.split(/\s[—–-]\s|[;:,.]/)[0]!.toLowerCase();
  const escaped = life.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`).test(lead);
}

export interface GuideItem {
  label: string;
  text: string;
}

export type GuideTab =
  | { id: "growing"; label: "Germination & Growing"; items: GuideItem[]; goodToKnow: string[] }
  | { id: "harvest"; label: "Harvest"; text: string }
  | { id: "seed-saving"; label: "Seed Saving"; difficulty: string | null; items: GuideItem[] };

const GROWING_LABELS = [
  ["sowing", "Sowing"],
  ["germination", "Germination"],
  ["transplanting", "Transplanting"],
  ["days_to_bloom", "Days to bloom"],
  ["spacing", "Spacing"],
  ["growing", "Growing"],
] as const;

const SEED_SAVING_LABELS = [
  ["when_to_harvest", "When to harvest"],
  ["how_to_collect", "How to collect"],
  ["cleaning", "Cleaning"],
  ["drying", "Drying"],
  ["storage", "Storage"],
  ["pollination_notes", "Pollination"],
] as const;

function itemsOf<K extends string>(src: Partial<Record<K, string | null>>, labels: readonly (readonly [K, string])[]): GuideItem[] {
  return labels.flatMap(([key, label]) => {
    const text = src[key]?.trim();
    return text ? [{ label, text }] : [];
  });
}

/**
 * The tabs for a crop, in life-arc order: Germination & Growing → Harvest → Seed Saving.
 * A tab is present only when the crop has content for it; [] means no tab section at all.
 */
export function growerGuideTabs(guide: GrowerGuide | null | undefined): GuideTab[] {
  if (!guide) return [];
  const tabs: GuideTab[] = [];
  const g = guide.growing;
  if (g) {
    const items = itemsOf(g, GROWING_LABELS);
    const goodToKnow = g.good_to_know.map((x) => x.trim()).filter(Boolean);
    if (items.length || goodToKnow.length) tabs.push({ id: "growing", label: "Germination & Growing", items, goodToKnow });
    const harvest = g.harvest_for_cutting?.trim();
    if (harvest) tabs.push({ id: "harvest", label: "Harvest", text: harvest });
  }
  const s = guide.seed_saving;
  if (s) {
    const items = itemsOf(s, SEED_SAVING_LABELS);
    const difficulty = s.difficulty?.trim() || null;
    if (items.length || difficulty) tabs.push({ id: "seed-saving", label: "Seed Saving", difficulty, items });
  }
  return tabs;
}
