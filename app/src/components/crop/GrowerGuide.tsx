import type { GuideItem, GuideTab } from "../../lib/grower-guide";
import { GuideTabs } from "./GuideTabs";

function Items({ items }: { items: GuideItem[] }) {
  if (!items.length) return null;
  return (
    <dl className="guide-items">
      {items.map((it) => (
        <div key={it.label}>
          <dt className="guide-item-label">{it.label}</dt>
          <dd className="guide-item-text">{it.text}</dd>
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
            <div className="guide-good-to-know" data-testid="grower-guide-good-to-know">
              <p className="guide-good-to-know-heading">Good to know</p>
              {tab.goodToKnow.length === 1 ? (
                <p className="guide-good-to-know-single">{tab.goodToKnow[0]}</p>
              ) : (
                <ul className="guide-good-to-know-list">
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
            <p className="guide-difficulty" data-testid="seed-saving-difficulty">
              Saving seed: {tab.difficulty}
            </p>
          ) : null}
          <Items items={tab.items} />
        </>
      );
  }
}

/**
 * The crop page's grower guide (after the variety grid): Germination &
 * Growing → Harvest → Seed Saving, each tab only when the crop has content
 * for it. Renders nothing when there are no tabs. All panels are
 * server-rendered; GuideTabs turns them into tabs once JS runs. Ported
 * from v2's GrowerGuide.
 */
export function GrowerGuide({ tabs, cropName }: { tabs: GuideTab[]; cropName: string }) {
  if (!tabs.length) return null;
  return (
    <section className="card guide" aria-labelledby="grower-guide-heading" data-testid="grower-guide">
      <h2 id="grower-guide-heading" className="guide-heading">
        Growing {cropName}
      </h2>
      <div className="guide-tabs">
        <GuideTabs
          label={`Growing ${cropName}`}
          panels={tabs.map((t) => ({ id: `grower-guide-${t.id}`, label: t.label, content: panelContent(t) }))}
        />
      </div>
    </section>
  );
}
