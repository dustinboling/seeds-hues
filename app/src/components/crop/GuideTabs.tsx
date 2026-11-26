import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

export interface GuideTabPanel {
  /** Element id of the panel (also its #fragment without JS). */
  id: string;
  label: string;
  content: ReactNode;
}

const noopSubscribe = () => () => {};

/**
 * Progressive tabs for the crop-page grower guide — ported from v2's
 * GuideTabs.
 *
 * Server render / no JS: every panel is rendered and visible, stacked
 * under its own heading, with a list of in-page links to them — nothing
 * is hidden. After hydration the same panels become an ARIA tab set
 * (WAI-ARIA APG "Tabs, automatic activation"): role=tablist/tab/tabpanel,
 * aria-selected + aria-controls + aria-labelledby, roving tabindex, ←/→
 * (wrapping), Home/End, and Tab moves from the active tab into its panel
 * (tabindex=0).
 */
export function GuideTabs({ label, panels }: { label: string; panels: GuideTabPanel[] }) {
  // false on the server and during hydration, true once running in the browser.
  const enhanced = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [selected, setSelected] = useState<number | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  if (!enhanced) {
    return (
      <div data-testid="grower-guide-tabs" data-enhanced="false">
        <nav aria-label={label}>
          <ul className="guide-tabs-nav">
            {panels.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className="chip-filter" data-testid="grower-guide-tab">
                  {p.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {panels.map((p) => (
          <section key={p.id} id={p.id} aria-labelledby={`${p.id}-heading`} className="guide-panel" data-testid="grower-guide-panel">
            <h3 id={`${p.id}-heading`} className="guide-panel-heading">
              {p.label}
            </h3>
            <div className="guide-panel-body">{p.content}</div>
          </section>
        ))}
      </div>
    );
  }

  // A #fragment naming a panel (e.g. a shared link) opens that tab until the reader picks one.
  const fromHash = panels.findIndex((p) => `#${p.id}` === window.location.hash);
  const active = selected ?? (fromHash >= 0 ? fromHash : 0);

  const select = (i: number) => {
    const n = (i + panels.length) % panels.length;
    setSelected(n);
    tabRefs.current[n]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      select(i + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      select(i - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(panels.length - 1);
    }
  };

  return (
    <div data-testid="grower-guide-tabs" data-enhanced="true">
      <div role="tablist" aria-label={label} className="guide-tablist">
        {panels.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            id={`${p.id}-tab`}
            aria-selected={i === active}
            aria-controls={p.id}
            tabIndex={i === active ? 0 : -1}
            onClick={() => setSelected(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="guide-tab"
            data-testid="grower-guide-tab"
          >
            {p.label}
          </button>
        ))}
      </div>
      {panels.map((p, i) => (
        <div
          key={p.id}
          role="tabpanel"
          id={p.id}
          aria-labelledby={`${p.id}-tab`}
          hidden={i !== active}
          className="guide-panel"
          data-testid="grower-guide-panel"
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}
