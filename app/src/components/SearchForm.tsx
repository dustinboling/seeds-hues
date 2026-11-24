import { useId } from "react";
import { SearchIcon } from "./icons";

/**
 * The search box's no-JavaScript core: a plain GET form targeting /search.
 * Functional without JavaScript (Bea §4.5: the audit's search-form check);
 * the hydrated autocomplete panel is Slice 4's in-place layer, layered on
 * this form without changing its resting markup.
 */
export function SearchForm({ label }: { label: string }) {
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
        placeholder="Variety, flower or Latin name…"
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
