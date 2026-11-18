import type { GuideItem, GuideTab } from "@/lib/grower-guide";
import { GuideTabs } from "./GuideTabs";

function Items({ items }: { items: GuideItem[] }) {
  if (!items.length) return null;
  return (
    <dl className="space-y-3">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="font-semibold">{it.label}</dt>
          <dd className="mt-0.5">{it.text}</dd>
        </div>
      ))}
    </dl>
  );
}

function panelContent(tab: GuideTab) {
  switch (tab.id) {
    case "growing":
      return (
        <>
          <Items items={tab.items} />
          {tab.goodToKnow.length ? (
            <div className="mt-4 rounded-lg bg-leaf-50 p-3" data-testid="grower-guide-good-to-know">
              <p className="font-semibold">Good to know</p>
              {tab.goodToKnow.length === 1 ? (
                <p className="mt-0.5">{tab.goodToKnow[0]}</p>
              ) : (
                <ul className="mt-0.5 list-disc space-y-1 pl-5">
                  {tab.goodToKnow.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </>
      );
    case "harvest":
      return <p>{tab.text}</p>;
    case "seed-saving":
      return (
        <>
          {tab.difficulty ? (
            <p className="mb-3 font-semibold" data-testid="seed-saving-difficulty">
              Saving seed: {tab.difficulty}
            </p>
          ) : null}
          <Items items={tab.items} />
        </>
      );
  }
}

/**
 * The crop page's grower guide (after the variety grid): Germination & Growing → Harvest → Seed
 * Saving, each tab only when the crop has content for it. Renders nothing when there are no tabs.
 * All panels are server-rendered; GuideTabs turns them into tabs once JS runs.
 */
export function GrowerGuide({ tabs, cropName }: { tabs: GuideTab[]; cropName: string }) {
  if (!tabs.length) return null;
  return (
    <section className="card mt-8 max-w-3xl p-4 sm:p-6" aria-labelledby="grower-guide-heading" data-testid="grower-guide">
      <h2 id="grower-guide-heading" className="font-semibold">
        Growing {cropName}
      </h2>
      <div className="mt-3">
        <GuideTabs
          label={`Growing ${cropName}`}
          panels={tabs.map((t) => ({ id: `grower-guide-${t.id}`, label: t.label, content: panelContent(t) }))}
        />
      </div>
    </section>
  );
}
