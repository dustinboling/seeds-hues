/**
 * C4 duplicate-variety decision view: two variety panels — the held variety FIRST, the
 * existing variety second, the order never swaps — side by side on iPad landscape/desktop,
 * stacked below that with a sticky mini-summary. The comparison strip states neutral
 * computed verdicts; the design takes no side. Both roles decide (binding), through two
 * equal-weight secondary buttons; Skip records seen, never decided.
 */
import type { ReactNode } from "react";
import { DuplicateChoice } from "./decision-controls";
import type { DetailShell, HoldDetail } from "./detail-types";

function Panel({ eyebrow, name, cropLine, latinName, sellers, footer }: { eyebrow: string; name: string; cropLine: string; latinName: string | null; sellers: { name: string; title: string | null; url: string | null }[]; footer?: ReactNode }) {
  return (
    <section aria-label={eyebrow} className="card flex min-w-0 flex-col gap-2 p-4 min-[744px]:p-5">
      <p className="font-sans text-[12px] font-bold uppercase tracking-[0.09em] text-muted">{eyebrow}</p>
      <h3 className="text-xl font-semibold">{name}</h3>
      <p className="font-sans text-sm text-ink-soft">{cropLine}</p>
      {latinName ? <p className="font-sans text-sm italic text-ink-soft">{latinName}</p> : null}
      <h4 className="mt-1 font-sans text-sm font-semibold">Who sells it</h4>
      {sellers.length === 0 ? (
        <p className="font-sans text-sm text-muted">No sellers on record.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sellers.map((s, i) => (
            <li key={i} className="font-sans text-sm">
              <p className="font-semibold">{s.name}</p>
              {s.title ? <p className="text-ink-soft">{s.title}</p> : null}
              {s.url ? (
                <p>
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-link underline">
                    Open the product page
                  </a>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {footer}
    </section>
  );
}

export function DuplicateDetailView({ detail, queue, show, submittedOn }: DetailShell & { detail: HoldDetail }) {
  const d = detail;
  const existing = d.existing;
  const heldUrl = d.held.productUrl;
  const baseFields: Record<string, string> = {
    kind: "review",
    id: String(d.ref.id),
    queue,
    show: String(show),
    created_at: d.createdAt,
    held_name: d.held.name,
    candidate_name: existing?.name ?? d.candidateName,
  };
  return (
    <article aria-labelledby="review-detail-title" className="flex flex-col gap-4">
      <header>
        <h2 id="review-detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {d.held.name}
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">Possible duplicate · held {submittedOn}</p>
      </header>

      <p className="sticky top-0 z-10 rounded-[10px] bg-paper-deep p-2 font-sans text-sm font-semibold min-[1024px]:hidden">
        Comparing: &apos;{d.held.name}&apos; ↔ &apos;{existing?.name ?? d.candidateName}&apos;
      </p>

      <div className="grid grid-cols-1 gap-4 min-[1024px]:grid-cols-2">
        <Panel
          eyebrow="The held variety"
          name={d.held.name}
          cropLine={d.held.cropCommon ?? d.held.crop ?? "Unknown crop"}
          latinName={null}
          sellers={d.held.sellerName ? [{ name: d.held.sellerName, title: d.held.titleRaw, url: heldUrl }] : []}
        />
        {existing ? (
          <Panel
            eyebrow="The variety already in the directory"
            name={existing.name}
            cropLine={`${existing.commonName}${existing.seriesName ? ` · ${existing.seriesName} series` : ""}`}
            latinName={existing.latinName}
            sellers={existing.listings.map((l) => ({ name: l.sellerName, title: l.titleRaw, url: l.productUrl }))}
            footer={
              <>
                <p className="mt-1 font-sans text-sm text-ink-soft">
                  {existing.sellerCount} {existing.sellerCount === 1 ? "seller" : "sellers"}
                  {existing.aliases.length > 0 ? ` · also called ${existing.aliases.join(", ")}` : null}
                </p>
                <p className="font-sans text-[15px]">
                  <a href={`/variety/${existing.slug}`} target="_blank" rel="noreferrer" className="text-link underline">
                    Open the public page
                  </a>
                </p>
              </>
            }
          />
        ) : (
          <section aria-label="The variety already in the directory" className="card flex min-w-0 flex-col gap-2 p-4 min-[744px]:p-5">
            <p className="font-sans text-[12px] font-bold uppercase tracking-[0.09em] text-muted">The variety already in the directory</p>
            <p className="font-sans text-[15px]">The held-as match (&apos;{d.candidateName}&apos;) is no longer in the directory — it was merged or removed while this hold waited.</p>
          </section>
        )}
      </div>

      <ul aria-label="Comparison" className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface p-4 font-sans text-[15px] min-[744px]:p-5">
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 inline-block size-3 shrink-0 rounded-full bg-leaf" />
          {d.comparison.cropLine}
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 inline-block size-3 shrink-0 rounded-[3px] bg-leaf" />
          {d.comparison.nameLine}
        </li>
        <li className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 inline-block size-3 shrink-0 rounded-full border-2 border-leaf" />
          {d.comparison.sellerLine}
        </li>
      </ul>

      {d.holdReason || d.evidenceQuote ? (
        <section aria-label="Why the scout held it" className="rounded-[18px] border border-line bg-surface p-4 min-[744px]:p-5">
          <h3 className="font-sans text-base font-semibold">Why the scout held it</h3>
          {d.holdReason ? <p className="mt-1 font-sans text-[15px]">{d.holdReason}</p> : null}
          {d.evidenceQuote ? <p className="mt-1 font-sans text-sm text-muted">“{d.evidenceQuote}”</p> : null}
        </section>
      ) : null}

      <div className="border-t border-line pt-4">
        <DuplicateChoice held={d.held.name} existing={existing?.name ?? d.candidateName} baseFields={baseFields} />
        <form method="post" action="/admin/review/decide" className="mt-2">
          {Object.entries({ ...baseFields, action: "skip_hold" }).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          <button type="submit" className="link-button min-h-[44px] font-sans text-[15px]">
            Skip for now
          </button>
        </form>
      </div>
    </article>
  );
}
