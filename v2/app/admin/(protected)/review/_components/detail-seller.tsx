/**
 * C2 seller-candidate decision views: the hunt stream (the proposal as the record approval
 * will create) and the Add Your Farm stream (the legacy Submitted | Suggested comparison +
 * the never-auto-published draft evidence panel). Consequence copy is role-aware, verbatim
 * per spec Finding 2.
 */
import { SheetReasonButton } from "./decision-controls";
import type { DetailShell, FarmDetail, HuntDetail } from "./detail-types";

function Consequence({ role }: { role: string }) {
  return (
    <p className="font-sans text-[15px] text-ink-soft">
      {role === "admin"
        ? "Approving creates this seller. They aren't listed publicly until you finish their details and Small Farm classification in Sellers."
        : "Approving creates this seller. They aren't listed publicly until an admin finishes their details and Small Farm classification in Sellers."}
    </p>
  );
}

function DecisionBar({ role, queue, show, kind, id, createdAt, itemName, approveAction, approveLabel, declineLabel }: DetailShell & { kind: string; id: number; createdAt: string; itemName: string; approveAction: string; approveLabel: string; declineLabel: string }) {
  return (
    <div className="mt-4 border-t border-line pt-4">
      <Consequence role={role} />
      <div className="mt-3 flex flex-col gap-2 min-[744px]:flex-row">
        <form method="post" action="/admin/review/decide">
          <input type="hidden" name="action" value={approveAction} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={String(id)} />
          <input type="hidden" name="queue" value={queue} />
          <input type="hidden" name="show" value={String(show)} />
          <input type="hidden" name="created_at" value={createdAt} />
          <button type="submit" className="btn btn-primary w-full min-[744px]:w-auto">
            {approveLabel}
          </button>
        </form>
        <SheetReasonButton
          buttonLabel={declineLabel}
          sheetTitle={declineLabel}
          fields={{ action: approveAction === "approve_farm" ? "decline_farm" : "decline_candidate", kind, id: String(id), queue, show: String(show), created_at: createdAt, item_name: itemName }}
          submitLabel={declineLabel}
        />
      </div>
    </div>
  );
}

export function HuntDetailView({ detail, role, queue, show, submittedOn }: DetailShell & { detail: HuntDetail }) {
  const site = detail.website;
  return (
    <article aria-labelledby="review-detail-title" className="flex flex-col gap-4">
      <header>
        <h2 id="review-detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {detail.name}
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">Found by the hunt · {submittedOn}</p>
      </header>
      <section aria-label="The record approval will create" className="card flex flex-col gap-2 p-4 min-[744px]:p-5">
        <h3 className="font-sans text-base font-semibold">The record approval will create</h3>
        <dl className="flex flex-col gap-2 font-sans">
          <div className="flex flex-col gap-0.5 min-[744px]:flex-row min-[744px]:gap-3">
            <dt className="min-[744px]:w-32 shrink-0 text-sm text-muted">Name</dt>
            <dd className="text-base">{detail.name}</dd>
          </div>
          <div className="flex flex-col gap-0.5 min-[744px]:flex-row min-[744px]:gap-3">
            <dt className="min-[744px]:w-32 shrink-0 text-sm text-muted">Website</dt>
            <dd className="text-base">
              {site ? (
                <a href={site} target="_blank" rel="noreferrer" className="text-link underline">
                  {site}
                </a>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 min-[744px]:flex-row min-[744px]:gap-3">
            <dt className="min-[744px]:w-32 shrink-0 text-sm text-muted">Domain</dt>
            <dd className="text-base">{detail.domain ?? "—"}</dd>
          </div>
        </dl>
      </section>
      <DecisionBar role={role} queue={queue} show={show} submittedOn={submittedOn} kind="review" id={detail.ref.id} createdAt={detail.createdAt} itemName={detail.name} approveAction="approve_candidate" approveLabel="Approve" declineLabel="Decline" />
    </article>
  );
}

export function FarmDetailView({ detail, role, queue, show, submittedOn }: DetailShell & { detail: FarmDetail }) {
  const d = detail;
  const site = d.website;
  const suggestedKeys = Object.keys(d.suggested);
  return (
    <article aria-labelledby="review-detail-title" className="flex flex-col gap-4">
      <header>
        <h2 id="review-detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {d.name}
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">Add Your Farm submission · {submittedOn}</p>
      </header>

      <section aria-label="Submitted and suggested values" className="card overflow-x-auto p-4 min-[744px]:p-5">
        <h3 className="font-sans text-base font-semibold">Submitted | Suggested</h3>
        <table className="mt-2 w-full font-sans text-[15px]">
          <thead>
            <tr className="border-b border-line text-left text-sm text-muted">
              <th scope="col" className="py-2 pr-3 font-semibold">Field</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Submitted</th>
              <th scope="col" className="py-2 font-semibold">Suggested from their site</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-3 text-left font-semibold">Farm</th>
              <td className="py-2 pr-3">{d.name}</td>
              <td className="py-2 text-muted">—</td>
            </tr>
            <tr className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-3 text-left font-semibold">Contact</th>
              <td className="py-2 pr-3">
                {d.contactName} · {d.contactEmail}
              </td>
              <td className="py-2 text-muted">—</td>
            </tr>
            {(["city", "state", "website", "business_phone"] as const).map((key) => {
              const submitted = key === "business_phone" ? d.businessPhone : key === "city" ? d.city : key === "state" ? d.state : d.website;
              const suggested = d.suggested[key] ?? (key === "business_phone" ? d.suggested.phone : undefined);
              return (
                <tr key={key} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">
                    {key === "business_phone" ? "Phone" : key[0]!.toUpperCase() + key.slice(1)}
                  </th>
                  <td className="py-2 pr-3">
                    {key === "website" && site ? (
                      <a href={site} target="_blank" rel="noreferrer" className="text-link underline">
                        {submitted}
                      </a>
                    ) : (
                      submitted
                    )}
                  </td>
                  <td className="py-2">{suggested ? `${suggested} (suggested)` : <span className="text-muted">—</span>}</td>
                </tr>
              );
            })}
            {suggestedKeys
              .filter((k) => !["city", "state", "website", "phone", "business_phone"].includes(k))
              .map((k) => (
                <tr key={k} className="border-b border-line align-top last:border-b-0">
                  <th scope="row" className="py-2 pr-3 text-left font-semibold">
                    {k}
                  </th>
                  <td className="py-2 pr-3 text-muted">—</td>
                  <td className="py-2">
                    {d.suggested[k]} (suggested)
                  </td>
                </tr>
              ))}
            <tr className="border-b border-line align-top">
              <th scope="row" className="py-2 pr-3 text-left font-semibold">About</th>
              <td className="py-2 pr-3" colSpan={2}>{d.growsText}</td>
            </tr>
            <tr className="border-b border-line align-top last:border-b-0">
              <th scope="row" className="py-2 pr-3 text-left font-semibold">Varieties</th>
              <td className="py-2 pr-3" colSpan={2}>{d.varietiesText}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {d.draftSummary || d.evidence.length > 0 ? (
        <section aria-label="Draft summary" className="rounded-[18px] border border-line-strong bg-leaf-50 p-4 min-[744px]:p-5">
          <h3 className="font-sans text-base font-semibold">Draft summary — never published automatically</h3>
          {d.draftSummary ? <p className="mt-2 font-sans text-[15px]">{d.draftSummary}</p> : null}
          {d.evidence.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-2">
              {d.evidence.map((e, i) => (
                <li key={i} className="font-sans text-sm">
                  <p>{e.claim}</p>
                  <p className="text-muted">“{e.quote}”</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <DecisionBar role={role} queue={queue} show={show} submittedOn={submittedOn} kind="farm" id={d.ref.id} createdAt={d.createdAt} itemName={d.name} approveAction="approve_farm" approveLabel="Approve" declineLabel="Decline" />
    </article>
  );
}
