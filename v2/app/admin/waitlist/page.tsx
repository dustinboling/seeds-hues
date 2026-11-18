import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminPrincipal } from "@/lib/admin-session";
import { getServices } from "@/lib/services/context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Waiting-list demand (admin)", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * /admin/waitlist (admin key, same admin-token pattern as /api/v1/admin): the seller-hunting
 * priority list — varieties ranked by active waiters — plus account/membership totals, outbox
 * status, and the Add Your Farm review queue with its auto-drafted summary (draft + evidence) and
 * machine-SUGGESTED values beside the submitted ones. Approve / decline and the farm-owner flag
 * are set here; nothing publishes from this page (catalog entries are made by hand).
 */
export default async function AdminWaitlistPage({ searchParams }: Props) {
  const sp = await searchParams;
  const services = await getServices();
  const principal = await adminPrincipal(services, (await cookies()).get(ADMIN_COOKIE)?.value);
  if (!principal) {
    return (
      <article className="max-w-xl" aria-labelledby="admin-title">
        <h1 id="admin-title" className="text-3xl font-semibold text-leaf">
          Admin sign-in
        </h1>
        {sp.error ? (
          <p role="alert" className="mt-3 font-medium text-warn">
            That key is not a valid admin key.
          </p>
        ) : null}
        <form method="post" action="/admin/login" className="mt-4 flex flex-col gap-3">
          <label htmlFor="admin-key" className="text-sm font-semibold">
            Admin API key
          </label>
          <input id="admin-key" name="key" type="password" required autoComplete="off" className="field" />
          <div>
            <button type="submit" className="btn btn-primary">
              Continue
            </button>
          </div>
        </form>
      </article>
    );
  }
  const v = await services.farms.demandView(100);
  const note = Array.isArray(sp.note) ? sp.note[0] : sp.note;
  return (
    <article aria-labelledby="admin-title" className="flex flex-col gap-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="admin-title" className="text-3xl font-semibold text-leaf">
          Waiting-list demand
        </h1>
        <form method="post" action="/admin/login">
          <input type="hidden" name="logout" value="1" />
          <button type="submit" className="btn btn-secondary">
            Sign out ({principal.label})
          </button>
        </form>
      </header>
      {note ? (
        <p role="status" className="card p-3 font-medium">
          {note}
        </p>
      ) : null}

      <section aria-labelledby="totals-title">
        <h2 id="totals-title" className="text-xl font-semibold">
          Totals
        </h2>
        <dl className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Accounts", v.totals.accounts],
            ["Verified emails", v.totals.verified],
            ["Memberships", v.totals.memberships],
            ["Waiting (not yet alerted)", v.totals.active_memberships],
            ["Alerted", v.totals.alerted_memberships],
          ].map(([k, n]) => (
            <div key={String(k)} className="card p-3">
              <dt className="text-sm text-muted">{k}</dt>
              <dd className="text-2xl font-semibold">{n}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-sm">
          Outbox:{" "}
          {v.outbox.length ? v.outbox.map((o) => `${o.channel} ${o.status} ${o.count}`).join(" · ") : "empty"}
        </p>
      </section>

      <section aria-labelledby="ranked-title">
        <h2 id="ranked-title" className="text-xl font-semibold">
          Most-waited varieties
        </h2>
        {v.varieties.length === 0 ? (
          <p className="mt-2 text-muted">No one is waiting on a variety yet.</p>
        ) : (
          <table className="mt-2 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className="py-2 pr-3">
                  Variety
                </th>
                <th scope="col" className="py-2 pr-3">
                  Crop
                </th>
                <th scope="col" className="py-2 pr-3">
                  Sellers
                </th>
                <th scope="col" className="py-2 pr-3">
                  Waiters (verified)
                </th>
              </tr>
            </thead>
            <tbody>
              {v.varieties.map((r) => (
                <tr key={r.slug} className="border-b border-line">
                  <td className="py-2 pr-3">
                    <a href={`/variety/${r.slug}`}>{r.name}</a>
                  </td>
                  <td className="py-2 pr-3">{r.crop}</td>
                  <td className="py-2 pr-3">{r.seller_count}</td>
                  <td className="py-2 pr-3">
                    {r.waiters} ({r.verified_waiters})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section aria-labelledby="farms-title" className="flex flex-col gap-4">
        <h2 id="farms-title" className="text-xl font-semibold">
          Add Your Farm submissions
        </h2>
        {v.farm_submissions.length === 0 ? <p className="text-muted">No submissions yet.</p> : null}
        {v.farm_submissions.map((s) => (
          <div key={s.id} className="card flex flex-col gap-3 p-4" data-testid={`farm-submission-${s.id}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">
                #{s.id} {s.farmName}
              </h3>
              <span className="chip">{s.status}</span>
            </div>
            <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr_1fr]">
              <dt className="font-semibold">Field</dt>
              <dd className="font-semibold">Submitted</dd>
              <dd className="font-semibold">Machine-suggested (from the farm’s site)</dd>
              {(
                [
                  ["City", s.city, s.suggestedFields.city],
                  ["State", s.state, s.suggestedFields.state],
                  ["Website", s.website, null],
                  ["Business phone", s.businessPhone, s.suggestedFields.business_phone],
                  ["Instagram", s.instagramUrl, s.suggestedFields.instagram],
                  ["TikTok", s.tiktokUrl, s.suggestedFields.tiktok],
                  ["Facebook", s.facebookUrl, s.suggestedFields.facebook],
                  ["Google Business Profile", s.gbpUrl, null],
                  ["Wholesale", s.wholesale === null ? null : s.wholesale ? "yes" : "no", null],
                  ["Contact", `${s.contactName} <${s.contactEmail}>`, null],
                  ["Account", s.userId ? `#${s.userId}` : "not signed in", null],
                ] as [string, string | null, string | null | undefined][]
              ).map(([k, a, b]) => (
                <div key={k} className="contents">
                  <dt className="text-muted">{k}</dt>
                  <dd className="break-words">{a ?? "—"}</dd>
                  <dd className="break-words text-muted">{b ? `${b} (suggested)` : "—"}</dd>
                </div>
              ))}
            </dl>
            <details>
              <summary className="cursor-pointer font-medium">About + varieties</summary>
              <p className="mt-2 whitespace-pre-line text-sm">{s.growsText}</p>
              <p className="mt-2 whitespace-pre-line text-sm">{s.varietiesText}</p>
              {s.notes ? <p className="mt-2 whitespace-pre-line text-sm">Notes: {s.notes}</p> : null}
            </details>
            <div className="rounded-lg bg-leaf-50 p-3 text-sm">
              <p className="font-semibold">
                Auto-drafted summary — DRAFT, {s.draftStatus}
                {s.draftNote ? ` · ${s.draftNote}` : ""}
              </p>
              {s.draftSummary ? <p className="mt-1">{s.draftSummary}</p> : null}
              {s.draftEvidence.length ? (
                <ol className="mt-2 list-decimal pl-5">
                  {s.draftEvidence.map((c, i) => (
                    <li key={i} className="mt-1">
                      {c.claim} <span className="text-muted">— “{c.quote}” ({c.url})</span>
                    </li>
                  ))}
                </ol>
              ) : null}
              <p className="mt-2 text-muted">Copy or edit this into the seller’s description when you create the catalog entry. It is never published automatically.</p>
            </div>
            {s.status === "pending" ? (
              <div className="flex flex-wrap items-end gap-3">
                <form method="post" action="/admin/waitlist/action" className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="op" value="approve" />
                  <input type="hidden" name="id" value={s.id} />
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Seller slug (once the catalog entry exists)</span>
                    <input name="seller" pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field" />
                  </label>
                  <button type="submit" className="btn btn-primary">
                    Approve
                  </button>
                </form>
                <form method="post" action="/admin/waitlist/action">
                  <input type="hidden" name="op" value="reject" />
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className="btn btn-secondary">
                    Decline
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-sm text-muted">
                Reviewed {s.reviewedAt ?? ""} by {s.reviewedBy ?? "?"}
                {s.sellerSlug ? ` · linked seller ${s.sellerSlug}` : ""}
              </p>
            )}
          </div>
        ))}
      </section>

      <section aria-labelledby="owner-title" className="card flex flex-col gap-3 p-4">
        <h2 id="owner-title" className="text-xl font-semibold">
          Farm-owner flag
        </h2>
        <p className="text-sm text-muted">
          Admin-set only; every change is written to the audit trail. Revoking keeps the account and its waiting lists.
        </p>
        {(["grant", "revoke"] as const).map((op) => (
          <form key={op} method="post" action="/admin/waitlist/action" className="flex flex-wrap items-end gap-2">
            <input type="hidden" name="op" value={op} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-semibold">Account (id or email)</span>
              <input name="user" required className="field" />
            </label>
            {op === "grant" ? (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-semibold">Seller slug</span>
                <input name="seller" required pattern="[a-z0-9]+(-[a-z0-9]+)*" className="field" />
              </label>
            ) : null}
            <button type="submit" className={op === "grant" ? "btn btn-primary" : "btn btn-secondary"}>
              {op === "grant" ? "Set farm owner" : "Revoke farm owner"}
            </button>
          </form>
        ))}
      </section>
    </article>
  );
}
