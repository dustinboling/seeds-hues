/**
 * Accounts section (Slice C, spec §7 G1–G2): the account list + account detail.
 * Admin only: a reviewer lands on the wrong-role state for this section (spec §7 A4
 * pattern), never on the data. Master–detail on iPad/desktop (360px list column + G2
 * in the pane); list screen on phones (tap → detail, with a back link). Writes post
 * to the session-authorized actions handler and land back here with their status
 * wording.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { getServices } from "@/lib/services/context";
import { firstParam } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { NoAccess } from "@/components/admin/NoAccess";
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { accountStatusLine, parseAccountListParams } from "@/lib/admin/accounts";
import { AccountList } from "./_components/account-list";
import { AccountDetail } from "./_components/account-detail";
import { accountHref } from "./_components/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Accounts" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function ErrorCard({ label, retry }: { label: string; retry: string }) {
  return (
    <div role="alert" className="rounded-card border border-line-strong bg-warn-50 p-4 admin:p-5">
      <p className="font-sans text-base font-semibold text-warn">{label} didn&apos;t load.</p>
      <p className="mt-1 font-sans text-[15px] text-ink">Check your connection and try again.</p>
      <p className="mt-3">
        <a href={retry} className="btn btn-secondary">
          Retry
        </a>
      </p>
    </div>
  );
}

function parseSelected(v: string | null): number | null {
  return v && /^\d{1,12}$/.test(v) && Number(v) > 0 ? Number(v) : null;
}

export default async function AdminAccountsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = parseAccountListParams({ q: firstParam(sp.q), show: firstParam(sp.show) });
  const explicit = parseSelected(firstParam(sp.account));
  const returnTo = accountHref({ account: explicit, q: params.q, show: params.show });
  const { viewer, totalWaiting } = await adminPageData(returnTo);
  if (viewer.role !== "admin") return <NoAccess variant="reviewer-accounts" />;
  const services = await getServices();
  const retry = returnTo;
  const c = { role: viewer.role, decider: { userId: viewer.id, name: viewer.name } };

  // ─── list pane ─────────────────────────────────────────────────────────────
  let rows: Awaited<ReturnType<typeof services.adminAccounts.listAccounts>>["rows"] = [];
  let total = 0;
  let listError = false;
  try {
    const list = await services.adminAccounts.listAccounts(params, c);
    rows = list.rows;
    total = list.total;
  } catch {
    listError = true;
  }

  // ─── selection: the deep link wins; otherwise the first row fills the pane ──
  const selected = explicit ?? rows[0]?.id ?? null;
  let detail: Awaited<ReturnType<typeof services.adminAccounts.detail>> | null = null;
  let detailError = false;
  let missing = false;
  if (!listError && selected) {
    try {
      detail = await services.adminAccounts.detail({ account: selected }, c);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "account_not_found") missing = true;
      else detailError = true;
    }
  }
  let sellerOptions: Awaited<ReturnType<typeof services.adminAccounts.sellerOptions>> = [];
  if (!listError && detail && !detail.isFarmOwner) {
    try {
      sellerOptions = await services.adminAccounts.sellerOptions(c);
    } catch {
      detailError = true;
    }
  }

  // ─── status wording (the actions handler only ever emits known codes) ───────
  const genericStatus = accountStatusLine({ status: firstParam(sp.status), name: firstParam(sp.name), role: firstParam(sp.role), seller: firstParam(sp.seller) });
  const ctx = { account: String(selected ?? ""), q: params.q, show: String(params.show) };

  return (
    <AdminShell viewer={viewer} section="accounts" reviewTotal={totalWaiting}>
      <h1 className="text-[28px] font-semibold leading-[1.15]">Accounts</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 admin:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`min-w-0 flex-col gap-3 admin:max-h-[calc(100dvh-10rem)] admin:overflow-y-auto ${explicit ? "hidden admin:flex" : "flex"}`}>
          {!explicit && genericStatus ? (
            <div className="mb-1">
              <StatusBanner status={genericStatus} />
            </div>
          ) : null}
          {listError ? <ErrorCard label="This list" retry={retry} /> : <AccountList rows={rows} total={total} params={params} selected={selected} />}
        </div>

        <section aria-label="Account detail" id="detail" className={`min-w-0 scroll-mt-4 ${explicit ? "block" : "hidden admin:block"}`}>
          {detailError ? (
            <ErrorCard label="This account" retry={retry} />
          ) : missing || !detail ? (
            <div className="card p-4 admin:p-5">
              <div aria-hidden="true" className="divider-stem" />
              <p className="mt-3 font-serif text-[17px] leading-[1.6]">
                {missing ? "That account is gone." : rows.length === 0 ? "No accounts match these filters." : "Select an account to inspect it."}
              </p>
              {missing ? (
                <p className="mt-2 font-sans text-[15px]">
                  <a href={accountHref({ q: params.q, show: params.show })} className="font-semibold text-link underline">
                    Back to all accounts
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <AccountDetail
              detail={detail}
              self={detail.id === viewer.id}
              ctx={{ ...ctx, account: String(detail.id) }}
              backHref={accountHref({ q: params.q, show: params.show })}
              genericStatus={genericStatus}
              sellerOptions={sellerOptions}
            />
          )}
        </section>
      </div>
    </AdminShell>
  );
}
