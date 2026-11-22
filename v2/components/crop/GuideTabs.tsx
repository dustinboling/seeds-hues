"use client";

import { useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";

export interface GuideTabPanel {
  /** Element id of the panel (also its #fragment without JS). */
  id: string;
  label: string;
  content: ReactNode;
}

const noopSubscribe = () => () => {};

/**
 * Progressive tabs for the crop-page grower guide.
 *
 * Server render / no JS: every panel is rendered and visible, stacked under its own heading, with
 * a list of in-page links to them — nothing is hidden. After hydration the same panels become an
 * ARIA tab set (WAI-ARIA APG "Tabs, automatic activation"): role=tablist/tab/tabpanel,
 * aria-selected + aria-controls + aria-labelledby, roving tabindex, ←/→ (wrapping), Home/End,
 * and Tab moves from the active tab into its panel (tabindex=0).
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
          <ul className="flex flex-wrap gap-2">
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
          <section key={p.id} id={p.id} aria-labelledby={`${p.id}-heading`} className="mt-5" data-testid="grower-guide-panel">
            <h3 id={`${p.id}-heading`} className="text-lg font-semibold text-leaf">
              {p.label}
            </h3>
            <div className="mt-2">{p.content}</div>
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
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: panels.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    select(next);
  };

  return (
    <div data-testid="grower-guide-tabs" data-enhanced="true">
      <div role="tablist" aria-label={label} className="flex flex-wrap gap-x-1 border-b border-line">
        {panels.map((p, i) => {
          const on = i === active;
          return (
            <button
              key={p.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${p.id}-tab`}
              aria-selected={on}
              aria-controls={p.id}
              tabIndex={on ? 0 : -1}
              onClick={() => setSelected(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              data-testid="grower-guide-tab"
              className={`tap -mb-px rounded-t-inner border-b-[3px] px-3 py-2 font-sans text-sm font-semibold transition-colors duration-150 ease-out ${
                on ? "border-leaf text-leaf" : "border-transparent text-ink-soft hover:bg-leaf-50 hover:text-leaf"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {panels.map((p, i) => (
        <div
          key={p.id}
          role="tabpanel"
          id={p.id}
          aria-labelledby={`${p.id}-tab`}
          tabIndex={0}
          hidden={i !== active}
          className="mt-4"
          data-testid="grower-guide-panel"
        >
          {p.content}
        </div>
      ))}
    </div>
  );
}
