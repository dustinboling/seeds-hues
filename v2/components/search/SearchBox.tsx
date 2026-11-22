"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { SearchResult } from "@/lib/validators";
import { SearchIcon } from "@/components/layout/icons";

/**
 * Search widget (R6): a plain GET form to /search (works without JavaScript) enhanced into an
 * ARIA 1.2 combobox with autocomplete from /api/v1/search (300 ms debounce, top 10).
 */
export function SearchBox({
  defaultValue = "",
  autoFocus = false,
  label = "Search seeds",
  size = "lg",
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  label?: string;
  size?: "lg" | "md";
}) {
  const router = useRouter();
  const id = useId();
  const listId = `${id}-list`;
  const [q, setQ] = useState(defaultValue);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return; // R12: two typed characters search
    const t = window.setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(term)}&limit=10`, {
          signal: ctrl.signal,
          headers: { "X-Client": "web-autocomplete/1" },
        });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { data: { results: SearchResult[] } | null };
        const r = body.data?.results ?? [];
        setResults(r);
        setActive(-1);
        setOpen(true);
        setStatus(r.length === 0 ? "No suggestions. Press Enter to search." : `${r.length} suggestion${r.length === 1 ? "" : "s"} available.`);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setResults([]);
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
        router.push(r.href);
      }
    }
  }

  const inputCls =
    size === "lg"
      ? "h-14 text-lg pl-11 pr-28"
      : "h-12 text-base pl-10 pr-24";

  return (
    <form role="search" action="/search" method="get" className="relative w-full" aria-label={label}>
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
        onFocus={() => results.length && setOpen(true)}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
        className={`w-full rounded-search border-2 border-line-strong bg-surface ${inputCls} text-ink placeholder:text-muted focus:border-leaf focus:outline-none focus-visible:outline-3 focus-visible:outline-focus`}
      />
      <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-leaf-600 ${size === "lg" ? "left-3.5" : "left-3"}`}>
        <SearchIcon />
      </span>
      <button type="submit" className="btn btn-primary absolute right-1.5 top-1/2 -translate-y-1/2">
        Search
      </button>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
      <ul
        id={listId}
        role="listbox"
        aria-label="Suggestions"
        hidden={!open || results.length === 0}
        className="absolute inset-x-0 top-full z-30 mt-1 max-h-[60vh] overflow-auto rounded-search border border-line-strong bg-surface p-1 shadow-card"
      >
        {results.map((r, i) => (
          <li
            key={`${r.type}-${r.slug}`}
            id={`${id}-opt-${i}`}
            role="option"
            aria-selected={i === active}
            className={`cursor-pointer rounded-inner px-3 py-2 ${i === active ? "bg-leaf-50" : ""}`}
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              router.push(r.href);
            }}
            onMouseEnter={() => setActive(i)}
          >
            <span className="block font-medium text-ink">{r.title}</span>
            <span className="block text-sm text-muted">
              {r.subtitle}
              {r.matchedAlias ? ` · also sold as “${r.matchedAlias}”` : ""}
            </span>
          </li>
        ))}
      </ul>
      {loading ? <span className="sr-only">Loading suggestions</span> : null}
    </form>
  );
}
