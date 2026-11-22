/**
 * F2 variety detail (Slice C): one screen, both roles — the Reviewer sees the identical
 * layout with actions absent (§5 rule 2). Name + crop/series/botanical line, the public
 * link (only when publicly visible), the Listings summary, the Waitlist count, Other
 * names (Admin add/remove on manual aliases; decision aliases labeled, never removable),
 * and the Admin-only danger zone (blocked while live listings exist).
 */
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { formatAdminDateTime } from "@/lib/admin-auth";
import { aliasLabel, varietyRemoveBlockLine } from "@/lib/admin/varieties";
import { AddAliasButton, RemoveAliasButton, RemoveVarietyButton, type VarietyCtx } from "./variety-sheets";

export interface VarietyDetailAlias {
  alias: string;
  source: string | null;
  decidedByName: string | null;
  createdAt: string | null;
}

export interface VarietyDetailListingCount {
  word: string;
  n: number;
}

export interface VarietyDetailData {
  slug: string;
  name: string;
  status: string;
  plantSlug: string;
  commonName: string;
  latinName: string | null;
  seriesName: string | null;
  listingCounts: VarietyDetailListingCount[];
  listingTotal: number;
  liveListingCount: number;
  aliases: VarietyDetailAlias[];
  waitlistCount: number;
}

export function VarietyDetail({ detail: v, role, ctx, backHref, genericStatus }: { detail: VarietyDetailData; role: string; ctx: VarietyCtx; backHref: string; genericStatus: { text: string } | null }) {
  const isAdmin = role === "admin";
  const publiclyVisible = v.status === "active";
  const subline = [v.commonName, v.seriesName ? `${v.seriesName} series` : null, v.latinName].filter(Boolean).join(" · ");
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="admin:hidden">
        <a href={backHref} className="font-sans text-[15px] font-semibold text-link underline">
          ← All varieties
        </a>
      </p>
      {genericStatus ? <StatusBanner status={genericStatus} /> : null}

      <header className="flex flex-col gap-2">
        <h2 id="detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {v.name}
        </h2>
        {subline ? <p className="font-sans text-[15px] text-ink-soft">{subline}</p> : null}
        {publiclyVisible ? (
          <p className="font-sans text-[15px]">
            <a href={`/variety/${v.slug}`} className="font-semibold text-link underline">
              View public page
            </a>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="listings-heading" className="card p-4 admin:p-5">
        <h3 id="listings-heading" className="text-xl font-semibold">
          Listings
        </h3>
        <p className="mt-1 font-sans text-sm tabular-nums text-muted">{v.listingTotal === 1 ? "1 listing" : `${v.listingTotal.toLocaleString("en-US")} listings`}</p>
        {v.listingCounts.length > 0 ? (
          <ul className="mt-2 flex flex-col divide-y divide-line font-sans text-base">
            {v.listingCounts.map((c) => (
              <li key={c.word} className="flex items-baseline justify-between gap-3 py-1.5">
                <span>{c.word}</span>
                <span className="tabular-nums text-ink-soft">{c.n.toLocaleString("en-US")}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-3 font-sans text-[15px]">
          <a href={`/admin/listings?variety=${v.slug}`} className="font-semibold text-link underline">
            See all in Listings
          </a>
        </p>
      </section>

      <section aria-labelledby="waitlist-heading" className="card p-4 admin:p-5">
        <h3 id="waitlist-heading" className="text-xl font-semibold">
          Waitlist
        </h3>
        <p className="mt-1 font-sans text-sm tabular-nums text-muted">{v.waitlistCount === 1 ? "1 person waiting" : `${v.waitlistCount.toLocaleString("en-US")} people waiting`}</p>
        <p className="mt-3 font-sans text-[15px]">
          <a href="/admin/statistics" className="font-semibold text-link underline">
            See waitlist statistics
          </a>
        </p>
      </section>

      <section aria-labelledby="names-heading" id="names" className="card scroll-mt-4 p-4 admin:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="names-heading" className="text-xl font-semibold">
            Other names
          </h3>
          {isAdmin ? <AddAliasButton ctx={ctx} /> : null}
        </div>
        {v.aliases.length === 0 ? (
          <p className="mt-2 font-serif text-[17px] leading-[1.6] text-ink-soft">No other names yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-line">
            {v.aliases.map((a) => {
              const decision = a.source === "duplicate_decision";
              return (
                <li key={a.alias} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <span className="block font-sans text-base font-semibold">{a.alias}</span>
                    <span className="mt-0.5 block font-sans text-sm tabular-nums text-muted">{aliasLabel(a, a.createdAt ? formatAdminDateTime(a.createdAt) : null)}</span>
                  </span>
                  {isAdmin && !decision ? <RemoveAliasButton alias={a.alias} ctx={ctx} /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isAdmin ? (
        <section aria-labelledby="danger-heading" className="mt-4 border-t border-line pt-6">
          <h3 id="danger-heading" className="text-xl font-semibold">
            Danger zone
          </h3>
          {v.liveListingCount > 0 ? (
            <div className="mt-3">
              <p className="font-sans text-base">{varietyRemoveBlockLine(v.liveListingCount)}</p>
              <p className="mt-2 font-sans text-[15px]">
                <a href={`/admin/listings?variety=${v.slug}`} className="font-semibold text-link underline">
                  See its listings
                </a>
              </p>
            </div>
          ) : (
            <div className="mt-3">
              <RemoveVarietyButton varietyName={v.name} ctx={ctx} />
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
