/**
 * G2 account detail (Slice C, Admin only): name, email, phone, joined date, waitlist
 * count, account status, and the two management panels — Role (current role as a word,
 * Change role → the verbatim radio-card sheet, Grant Admin behind its §10.1 confirm,
 * the audit history line) and Farm owner (state in words, set/remove behind their
 * buttons, the audit history beneath). Self-view: the role controls are absent and a
 * line explains why.
 */
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { formatAdminDate, formatAdminDateTime } from "@/lib/admin-auth";
import { accountStatusWord, currentRoleWords, roleHistoryLine, SELF_ROLE_LINE, shownName } from "@/lib/admin/accounts";
import { ChangeRoleButton, RevokeFarmOwnerButton, SetFarmOwnerButton, type AccountCtx, type SellerOption } from "./account-sheets";

export interface AccountRoleAuditRow {
  toRole: string;
  createdAt: string;
  actor: string;
}

export interface AccountFarmAuditRow {
  action: string;
  createdAt: string;
  actor: string;
}

export interface AccountDetailData {
  id: number;
  name: string;
  displayName: string | null;
  email: string;
  phone: string;
  createdAt: string;
  role: string;
  status: string;
  isFarmOwner: boolean;
  farmSeller: { slug: string; name: string } | null;
  waitlistCount: number;
  roleAudit: AccountRoleAuditRow[];
  farmOwnerAudit: AccountFarmAuditRow[];
}

export function AccountDetail({
  detail: a,
  self,
  ctx,
  backHref,
  genericStatus,
  sellerOptions,
}: {
  detail: AccountDetailData;
  self: boolean;
  ctx: AccountCtx;
  backHref: string;
  genericStatus: { text: string } | null;
  sellerOptions: SellerOption[];
}) {
  const name = shownName(a);
  const latestRole = a.roleAudit[0] ?? null;
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="min-[744px]:hidden">
        <a href={backHref} className="font-sans text-[15px] font-semibold text-link underline">
          ← All accounts
        </a>
      </p>
      {genericStatus ? <StatusBanner status={genericStatus} /> : null}

      <header className="flex flex-col gap-2">
        <h2 id="detail-title" className="text-[28px] font-semibold leading-[1.15]">
          {name}
        </h2>
        <dl className="flex flex-col gap-1 font-sans text-[15px]">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink-soft">Email:</dt>
            <dd className="break-all">{a.email}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink-soft">Phone:</dt>
            <dd>{a.phone ? a.phone : <span className="text-muted">Not set</span>}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 tabular-nums">
            <dt className="font-semibold text-ink-soft">Joined:</dt>
            <dd>{formatAdminDate(a.createdAt)}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2 tabular-nums">
            <dt className="font-semibold text-ink-soft">Waiting lists:</dt>
            <dd>{a.waitlistCount.toLocaleString("en-US")}</dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-semibold text-ink-soft">Status:</dt>
            <dd>{accountStatusWord(a.status)}</dd>
          </div>
        </dl>
      </header>

      <section aria-labelledby="role-heading" id="role" className="card scroll-mt-4 p-4 min-[744px]:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="role-heading" className="text-xl font-semibold">
            Role
          </h3>
          {self ? null : <ChangeRoleButton accountName={name} currentRole={a.role} ctx={ctx} />}
        </div>
        <p className="mt-2 font-sans text-base">{currentRoleWords(a.role)}</p>
        <p className="mt-1 font-sans text-sm tabular-nums text-muted">{roleHistoryLine(latestRole, latestRole ? formatAdminDateTime(latestRole.createdAt) : null, formatAdminDate(a.createdAt), a.role)}</p>
        {self ? <p className="mt-2 font-sans text-[15px] text-ink-soft">{SELF_ROLE_LINE}</p> : null}
      </section>

      <section aria-labelledby="farm-heading" id="farm" className="card scroll-mt-4 p-4 min-[744px]:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id="farm-heading" className="text-xl font-semibold">
            Farm owner
          </h3>
          {a.isFarmOwner ? <RevokeFarmOwnerButton ctx={ctx} /> : <SetFarmOwnerButton accountName={name} sellers={sellerOptions} ctx={ctx} />}
        </div>
        <p className="mt-2 font-sans text-base">
          {a.isFarmOwner ? (
            a.farmSeller ? (
              <>
                Farm owner of{" "}
                <a href={`/admin/sellers?seller=${a.farmSeller.slug}`} className="font-semibold text-link underline">
                  {a.farmSeller.name}
                </a>
              </>
            ) : (
              "Farm owner — the linked farm is gone."
            )
          ) : (
            "Not a farm owner."
          )}
        </p>
        {a.farmOwnerAudit.length > 0 ? (
          <ol className="mt-2 flex flex-col divide-y divide-line">
            {a.farmOwnerAudit.map((e, i) => (
              <li key={`${e.action}-${e.createdAt}-${i}`} className="py-2 font-sans text-[15px] tabular-nums text-ink-soft">
                {e.action === "granted" ? "Granted" : e.action === "revoked" ? "Revoked" : e.action} {formatAdminDateTime(e.createdAt)} · by {e.actor}
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}
