/**
 * Sellers section (Slice B, spec §7 D1–D5): the working list + seller detail.
 * Master–detail on iPad/desktop (360px list column + D2 in the pane); list screen on
 * phones (tap → detail, with a back link). Every seller is addressable by ?seller=slug
 * (deep links land after sign-in via the return path). Writes post to the
 * session-authorized actions handler and land back here with their status wording.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { getServices } from "@/lib/services/context";
import { firstParam } from "@/lib/admin-auth";
import { sellerTypeLabel } from "@/lib/format";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import {
  classificationStatusLine,
  editStatusLine,
  parseSellerListParams,
  platformLabel,
  SELLER_FIELD_LABELS,
  sellerStatusLine,
} from "@/lib/admin/sellers";
import { SellerList } from "./_components/seller-list";
import { SellerDetail } from "./_components/seller-detail";
import { sellerHref } from "./_components/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sellers" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function ErrorCard({ label, retry }: { label: string; retry: string }) {
  return (
    <div role="alert" className="rounded-[18px] border border-line-strong bg-warn-50 p-4 min-[744px]:p-5">
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

export default async function AdminSellersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = parseSellerListParams({ q: firstParam(sp.q), badge: firstParam(sp.badge), state: firstParam(sp.state), sort: firstParam(sp.sort) });
  const explicit = firstParam(sp.seller);
  const returnTo = sellerHref({ seller: explicit, q: params.q, badge: params.badge, state: params.state, sort: params.sort });
  const { viewer, totalWaiting } = await adminPageData(returnTo);
  const services = await getServices();
  const retry = returnTo;

  // The D3 select options mirror SELLER_TYPES / SELLER_PLATFORMS (lib/db/schema.ts) —
  // pages never import the DB directly (§3.4 guardrail). Pinned by the unit suite.
  const typeOptions = (["wholesale", "retail", "specialty"] as const).map((t) => ({ value: t, label: sellerTypeLabel(t) }));
  const platformOptions = (["shopify", "woocommerce", "squarespace", "other"] as const).map((p) => ({ value: p, label: platformLabel(p) }));

  // ─── list pane ─────────────────────────────────────────────────────────────
  let rows: Awaited<ReturnType<typeof services.adminSellers.listSellers>>["rows"] = [];
  let total = 0;
  let listError = false;
  try {
    const list = await services.adminSellers.listSellers(params);
    rows = list.rows;
    total = list.total;
  } catch {
    listError = true;
  }

  // ─── selection: the deep link wins; otherwise the first row fills the pane ──
  const selected = explicit ?? rows[0]?.slug ?? null;
  let detail: Awaited<ReturnType<typeof services.adminSellers.detail>> = null;
  let detailError = false;
  let missing = false;
  if (!listError && selected) {
    try {
      detail = await services.adminSellers.detail(selected);
      if (!detail) missing = true;
    } catch {
      detailError = true;
    }
  }

  // ─── status wording (the actions handler only ever emits known codes) ───────
  const updatedFields = (firstParam(sp.updated) ?? "").split(",").filter((f) => f in SELLER_FIELD_LABELS);
  const updatedLine = detail && updatedFields.length > 0 ? editStatusLine(updatedFields, updatedFields.length === 1 ? { [updatedFields[0]!]: firstParam(sp.updated_to) } : {}) : null;
  const classifiedParam = firstParam(sp.classified);
  const classifiedLine = detail && (classifiedParam === "small" || classifiedParam === "not") ? classificationStatusLine(classifiedParam === "small", firstParam(sp.published) === "1" ? detail.name : null) : null;
  const genericStatus = sellerStatusLine({ status: firstParam(sp.status), name: firstParam(sp.name) });
  const ctx = { seller: selected ?? "", q: params.q, badge: params.badge, state: params.state, sort: params.sort };

  return (
    <AdminShell viewer={viewer} section="sellers" reviewTotal={totalWaiting}>
      <h1 className="text-[28px] font-semibold leading-[1.15]">Sellers</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 min-[744px]:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`min-w-0 flex-col gap-3 min-[744px]:max-h-[calc(100dvh-10rem)] min-[744px]:overflow-y-auto ${explicit ? "hidden min-[744px]:flex" : "flex"}`}>
          {!explicit && genericStatus ? (
            <div className="mb-1">
              <StatusBanner status={genericStatus} />
            </div>
          ) : null}
          {listError ? <ErrorCard label="This list" retry={retry} /> : <SellerList rows={rows} total={total} params={params} selected={selected} />}
        </div>

        <section aria-label="Seller detail" id="detail" className={`min-w-0 scroll-mt-4 ${explicit ? "block" : "hidden min-[744px]:block"}`}>
          {detailError ? (
            <ErrorCard label="This seller" retry={retry} />
          ) : missing || !detail ? (
            <div className="card p-4 min-[744px]:p-5">
              <div aria-hidden="true" className="divider-stem" />
              <p className="mt-3 font-serif text-[17px] leading-[1.6]">
                {missing ? "That seller is gone." : rows.length === 0 ? "No sellers in the directory yet." : "Select a seller to inspect them."}
              </p>
              {missing ? (
                <p className="mt-2 font-sans text-[15px]">
                  <a href={sellerHref({ q: params.q, badge: params.badge, state: params.state, sort: params.sort })} className="font-semibold text-link underline">
                    Back to all sellers
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <SellerDetail
              detail={detail}
              role={viewer.role}
              ctx={{ ...ctx, seller: detail.slug }}
              backHref={sellerHref({ q: params.q, badge: params.badge, state: params.state, sort: params.sort })}
              updatedLine={updatedLine}
              classifiedLine={classifiedLine}
              genericStatus={genericStatus}
              typeOptions={typeOptions}
              platformOptions={platformOptions}
            />
          )}
        </section>
      </div>
    </AdminShell>
  );
}
