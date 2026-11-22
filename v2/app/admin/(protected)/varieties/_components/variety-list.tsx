/**
 * The F1 variety list column: search field (a field, not a form — names and aliases),
 * the single-select crop chips as a FilterStrip (never wraps), the count line, and the
 * windowed rows ("{n} sellers · {n} other names", alias matches labeled). Chips and rows
 * are links with aria-current — the list works with JS disabled.
 */
import { FilterStrip } from "@/components/ui/FilterStrip";
import { varietyHref } from "./urls";

export interface VarietyListRow {
  slug: string;
  name: string;
  commonName: string;
  liveSellers: number;
  aliasCount: number;
  matchedAlias: string | null;
}

export interface VarietyListParams {
  q: string | null;
  crop: string | null;
  show: number;
}

export interface CropOption {
  slug: string;
  commonName: string;
}

function chipClass(active: boolean): string {
  return `chip tap flex min-h-target items-center ${active ? "font-semibold" : ""}`;
}

function sellersLine(n: number): string {
  return n === 1 ? "1 seller" : `${n} sellers`;
}

function namesLine(n: number): string {
  return n === 1 ? "1 other name" : `${n} other names`;
}

export function VarietyList({ rows, total, params, selected, crops }: { rows: VarietyListRow[]; total: number; params: VarietyListParams; selected: string | null; crops: CropOption[] }) {
  const { q, crop, show } = params;
  const base = { variety: selected, q, crop, show };
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <form method="get" action="/admin/varieties" role="search" className="flex flex-col gap-2">
        {selected ? <input type="hidden" name="variety" value={selected} /> : null}
        {crop ? <input type="hidden" name="crop" value={crop} /> : null}
        <label htmlFor="variety-search" className="font-sans text-sm font-semibold">
          Search varieties
        </label>
        <div className="flex gap-2">
          <input id="variety-search" name="q" type="search" defaultValue={q ?? ""} maxLength={120} autoComplete="off" placeholder="Variety or another name" className="field min-h-target w-full" />
          <button type="submit" className="btn btn-secondary shrink-0">
            Search
          </button>
        </div>
      </form>

      <fieldset className="min-w-0">
        <legend className="eyebrow mb-1">Crop</legend>
        <FilterStrip legend="Filter by crop">
          <li className="flex-none">
            <a href={varietyHref({ ...base, crop: null })} aria-current={!crop ? "true" : undefined} className={chipClass(!crop)}>
              All
            </a>
          </li>
          {crops.map((c) => {
            const active = crop === c.slug;
            return (
              <li key={c.slug} className="flex-none">
                <a href={varietyHref({ ...base, crop: c.slug })} aria-current={active ? "true" : undefined} className={chipClass(active)}>
                  {c.commonName}
                </a>
              </li>
            );
          })}
        </FilterStrip>
      </fieldset>

      <p className="font-sans text-sm tabular-nums text-muted" aria-live="polite">
        {total === 1 ? "1 variety" : `${total.toLocaleString("en-US")} varieties`}
      </p>

      {rows.length === 0 ? (
        q ? (
          <div className="card p-4">
            <p className="font-serif text-[17px] leading-[1.6]">No varieties match &apos;{q}&apos;.</p>
            <p className="mt-3">
              <a href={varietyHref({ variety: selected, crop })} className="btn btn-secondary">
                Clear search
              </a>
            </p>
          </div>
        ) : (
          <p className="font-serif text-[17px] leading-[1.6] text-ink-soft">No varieties in the directory yet.</p>
        )
      ) : (
        <>
          <ol className="flex min-w-0 flex-col">
            {rows.map((r) => {
              const current = r.slug === selected;
              return (
                <li key={r.slug}>
                  <a
                    href={`${varietyHref({ variety: r.slug, q, crop, show })}#detail`}
                    aria-current={current ? "true" : undefined}
                    className={`block rounded-control border-b border-line px-3 py-3 font-sans last:border-b-0 ${current ? "bg-leaf-50" : "hover:bg-paper-deep"}`}
                  >
                    <span className="block text-base font-semibold">{r.name}</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{r.commonName}</span>
                    <span className="mt-0.5 block text-sm tabular-nums text-muted">
                      {sellersLine(r.liveSellers)} · {namesLine(r.aliasCount)}
                    </span>
                    {r.matchedAlias ? <span className="mt-0.5 block text-[13px] text-muted">Matched another name: &apos;{r.matchedAlias}&apos;</span> : null}
                  </a>
                </li>
              );
            })}
          </ol>
          <p className="font-sans text-[13px] tabular-nums text-muted">
            Showing {rows.length} of {total.toLocaleString("en-US")}
          </p>
          {rows.length < total ? (
            <p>
              <a href={varietyHref({ ...base, show: show + 50 })} className="btn btn-secondary">
                Show more
              </a>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
