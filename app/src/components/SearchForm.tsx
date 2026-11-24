import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { ApiSearchResult } from "../data/types";
import { useHydrated, vikeNavigate } from "./browse/InPlaceNav";
import { SearchIcon } from "./icons";

/**
 * The search box: a plain GET form to /search (works without JavaScript)
 * enhanced, after hydration only, into the ARIA 1.2 combobox — ported from
 * v2/components/search/SearchBox.tsx (same mount-value pristine rule, same
 * two-character minimum, same 300 ms debounce, same top-10 panel, same
 * keyboard contract, same status announcements; Vike client navigation
 * instead of next/router).
 *
 * The server render is the no-JS core, byte-stable (Bea §4.5: the audit's
 * search-form check runs against it): the combobox attributes, the
 * controlled value, and the suggestion panel appear only in the hydrated
 * upgrade. Autocomplete ranking is the API's: the panel renders the flat
 * ranked `results` of GET /api/v1/search verbatim, in order.
 *
 * The panel opens ONLY in response to the visitor's own input in this box
 * during this mount (§5.3.1): typing (once the field's value differs from
 * its mount value) or ArrowDown with results present. The mount value is
 * submitted text, not typed text — no fetch and no open occurs on mount,
 * and focus alone never opens the panel.
 */
export function SearchForm({
  label,
  defaultValue = "",
  autoFocus = false,
  suggest = fetchSuggestions,
  navigateFn = defaultNavigate,
}: {
  label: string;
  defaultValue?: string;
  autoFocus?: boolean;
  /** Ranked top-10 suggestions for a typed term (injected in tests). */
  suggest?: (term: string, signal: AbortSignal) => Promise<ApiSearchResult[]>;
  /** Result navigation (injected in tests; production: Vike client router). */
  navigateFn?: (href: string) => void | Promise<void>;
}) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return <SearchFormFloor label={label} defaultValue={defaultValue} autoFocus={autoFocus} />;
  }
  return (
    <SearchCombobox label={label} defaultValue={defaultValue} autoFocus={autoFocus} suggest={suggest} navigateFn={navigateFn} />
  );
}

/** The no-JavaScript floor: a plain GET form targeting /search. */
function SearchFormFloor({ label, defaultValue = "", autoFocus = false }: { label: string; defaultValue?: string; autoFocus?: boolean }) {
  const id = useId();
  return (
    <form role="search" action="/search" method="get" className="search-form" aria-label={label}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <input
        id={`${id}-input`}
        name="q"
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        placeholder="Variety, flower or Latin name…"
        defaultValue={defaultValue}
        maxLength={100}
      />
      <span className="search-form-icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
      <p className="sr-only" role="status" aria-live="polite" />
    </form>
  );
}

function SearchCombobox({
  label,
  defaultValue,
  autoFocus,
  suggest,
  navigateFn,
}: {
  label: string;
  defaultValue: string;
  autoFocus: boolean;
  suggest: (term: string, signal: AbortSignal) => Promise<ApiSearchResult[]>;
  navigateFn: (href: string) => void | Promise<void>;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState(defaultValue);
  const [results, setResults] = useState<ApiSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  // The mount value (submitted text, e.g. the /search page's defaultValue): fetching and
  // opening happen only once the field's value differs from it — never on mount.
  const mountValue = useRef(defaultValue);
  const suggestRef = useRef(suggest);
  useEffect(() => {
    suggestRef.current = suggest;
  });

  useEffect(() => {
    if (q === mountValue.current) {
      // Pristine (mount, or typed back to the mount value): no fetch, no open. The sets are
      // no-ops on mount (already the initial state) and a true reset after typing.
      abortRef.current?.abort();
      setResults([]);
      setOpen(false);
      setActive(-1);
      setLoading(false);
      setStatus("");
      return;
    }
    const term = q.trim();
    if (term.length < 2) return; // R12: two typed characters search
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const r = await suggestRef.current(term, ctrl.signal);
        setResults(r);
        setActive(-1);
        setOpen(true);
        setStatus(r.length === 0 ? "No suggestions — press Enter to search." : `${r.length} suggestion${r.length === 1 ? "" : "s"} available.`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
          setActive(-1);
          setOpen(true);
          setStatus("Suggestions unavailable. Press Enter to search.");
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [q]);

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown" && results.length) setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? results.length - 1 : a - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      const r = results[active];
      if (r) {
        setOpen(false);
        void navigateFn(r.href);
      }
    }
  }

  function go(r: ApiSearchResult) {
    setOpen(false);
    void navigateFn(r.href);
  }

  // The visible empty/failure row (§5.3.3): when a typed query's panel is open with no
  // suggestions, the panel shows the status text as one non-interactive message row — never
  // an option — aria-hidden (the sr-only status line announces the identical text: one
  // message, announced once).
  const notice = open && results.length === 0 && status !== "" ? status : null;

  return (
    <form role="search" action="/search" method="get" className="search-form" aria-label={label}>
      <label htmlFor={`${id}-input`} className="sr-only">
        {label}
      </label>
      <input
        id={`${id}-input`}
        name="q"
        type="search"
        inputMode="search"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        enterKeyHint="search"
        autoFocus={autoFocus}
        placeholder="Variety, flower or Latin name…"
        value={q}
        maxLength={100}
        onChange={(e) => {
          const next = e.target.value;
          setQ(next);
          if (next.trim().length < 1) {
            abortRef.current?.abort();
            setResults([]);
            setOpen(false);
            setLoading(false);
            setStatus("");
          }
        }}
        onKeyDown={onKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        // Focus alone never opens the panel: it may only reopen results the visitor's own
        // typing produced in this mount (a pristine field — q still the mount value — reopens
        // nothing, even with cached results).
        onFocus={() => q !== mountValue.current && results.length > 0 && setOpen(true)}
        role="combobox"
        // The panel's own visibility (suggestions, notice, or failure row — hidden is
        // false in all three): the combobox reports expanded whenever it is on screen.
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
      />
      <span className="search-form-icon" aria-hidden="true">
        <SearchIcon />
      </span>
      <button type="submit" className="btn btn-primary">
        Search
      </button>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!open || (results.length === 0 && notice === null)}
        className="search-suggest"
      >
        {notice !== null ? (
          <li aria-hidden="true" className="search-suggest-notice">
            {notice}
          </li>
        ) : (
          results.map((r, i) => (
            <li
              key={`${r.type}-${r.slug}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // The active mark (AD-2): a 3 px left rule in full-strength leaf on the one
              // shared hover/keyboard state — the wash stays as a redundant channel. Inactive
              // rows reserve the width transparently, so activation never shifts the row.
              className={i === active ? "search-suggest-row search-suggest-active" : "search-suggest-row"}
              onMouseDown={(e) => {
                e.preventDefault();
                go(r);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="search-suggest-title">{r.title}</span>
              <span className="search-suggest-subtitle">
                {r.subtitle}
                {r.matchedAlias ? ` · also sold as “${r.matchedAlias}”` : ""}
              </span>
            </li>
          ))
        )}
      </ul>
      {loading ? <span className="sr-only">Loading suggestions</span> : null}
    </form>
  );
}

/** Production suggestions: the API's ranked top 10 for the typed term (same origin serves /api/v1). */
async function fetchSuggestions(term: string, signal: AbortSignal): Promise<ApiSearchResult[]> {
  const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}&limit=10`, {
    signal,
    headers: { "X-Client": "web-autocomplete/1" },
  });
  if (!res.ok) throw new Error(String(res.status));
  const body = (await res.json()) as { data?: { results?: unknown } | null };
  const results = body.data?.results;
  if (!Array.isArray(results)) return [];
  return results.filter((r): r is ApiSearchResult => isSuggestion(r));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSuggestion(value: unknown): value is ApiSearchResult {
  if (!isRecord(value)) return false;
  return (
    (value.type === "variety" || value.type === "series" || value.type === "crop" || value.type === "seller") &&
    typeof value.slug === "string" &&
    typeof value.title === "string" &&
    typeof value.subtitle === "string" &&
    typeof value.href === "string" &&
    (value.matchedAlias === null || typeof value.matchedAlias === "string")
  );
}

function defaultNavigate(href: string): Promise<void> {
  return vikeNavigate(href);
}
