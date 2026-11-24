import { useData } from "vike-react/useData";
import { SearchForm } from "../../src/components/SearchForm";
import { SearchBrowse } from "../../src/components/search/SearchBrowse";
import type { Data } from "./+data";

/**
 * /search — server-rendered grouped results (ported from
 * v2/app/search/page.tsx: same H1, same query-filled search box, same
 * bare-query guidance form with its browse shortcut chips, same grouped
 * results block with its truthful total heading and zero-results state).
 */
export default function Page() {
  const { q, result } = useData<Data>();
  return (
    <>
      <h1>Search</h1>
      <div className="search-page-box">
        <SearchForm label="Search flower seeds" defaultValue={q} autoFocus={!q} />
      </div>
      {!q ? (
        <section className="search-browse-hint" aria-labelledby="browse-title">
          <h2 id="browse-title">Not sure what to search for?</h2>
          <p>
            Try a crop (“sweet pea”), a variety (“King’s Ransom”) or a Latin name (“Papaver”). Two letters are enough to
            start; names a variety is also sold under match too.
          </p>
          <ul className="search-browse-chips">
            <li>
              <a href="/crop" className="chip-filter">
                Browse by crop
              </a>
            </li>
            <li>
              <a href="/variety" className="chip-filter">
                Browse all varieties
              </a>
            </li>
            <li>
              <a href="/seller" className="chip-filter">
                Browse sellers
              </a>
            </li>
          </ul>
        </section>
      ) : result ? (
        <section id="search-results" className="search-results" aria-labelledby="results-title">
          <SearchBrowse initial={result} q={q} />
        </section>
      ) : null}
    </>
  );
}
