/**
 * Listings section (Slice C, spec §7 E1–E2): the working list + listing detail.
 * Master–detail on iPad/desktop (360px list column + E2 in the pane); list screen on
 * phones (tap → detail, with a back link). Deep links (?seller= / ?variety=) filter
 * the list and render as removable chips. Writes post to the session-authorized
 * actions handler and land back here with their status wording.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { getServices } from "@/lib/services/context";
import { firstParam } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { listingStatusLine, parseListingListParams } from "@/lib/admin/listings";
import { ListingList } from "./_components/listing-list";
import { ListingDetail } from "./_components/listing-detail";
import { listingHref } from "./_components/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Listings" };

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

export default async function AdminListingsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = parseListingListParams({ q: firstParam(sp.q), chip: firstParam(sp.chip), seller: firstParam(sp.seller), variety: firstParam(sp.variety), show: firstParam(sp.show) });
  const explicit = parseSelected(firstParam(sp.listing));
  const returnTo = listingHref({ listing: explicit, q: params.q, chip: params.chip, seller: params.seller, variety: params.variety, show: params.show });
  const { viewer, totalWaiting } = await adminPageData(returnTo);
  const services = await getServices();
  const retry = returnTo;

  // ─── list pane ─────────────────────────────────────────────────────────────
  let rows: Awaited<ReturnType<typeof services.adminListings.listListings>>["rows"] = [];
  let total = 0;
  let listError = false;
  try {
    const list = await services.adminListings.listListings(params);
    rows = list.rows;
    total = list.total;
  } catch {
    listError = true;
  }
  let deepLinks = { seller: null as { slug: string; name: string } | null, variety: null as { slug: string; name: string } | null };
  if (!listError && (params.seller || params.variety)) {
    try {
      deepLinks = await services.adminListings.filterLabels({ seller: params.seller, variety: params.variety });
    } catch {
      listError = true;
    }
  }

  // ─── selection: the deep link wins; otherwise the first row fills the pane ──
  const selected = explicit ?? rows[0]?.id ?? null;
  let detail: Awaited<ReturnType<typeof services.adminListings.detail>> = null;
  let detailError = false;
  let missing = false;
  if (!listError && selected) {
    try {
      detail = await services.adminListings.detail(selected);
      if (!detail) missing = true;
    } catch {
      detailError = true;
    }
  }

  // ─── status wording (the actions handler only ever emits known codes) ───────
  const genericStatus = listingStatusLine({ status: firstParam(sp.status), variety: firstParam(sp.variety_name) ?? detail?.varietyName ?? null });
  const ctx = { listing: String(selected ?? ""), q: params.q, chip: params.chip, seller: params.seller, variety: params.variety, show: String(params.show) };

  return (
    <AdminShell viewer={viewer} section="listings" reviewTotal={totalWaiting}>
      <h1 className="text-[28px] font-semibold leading-[1.15]">Listings</h1>

      <div className="mt-4 grid grid-cols-1 gap-4 admin:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`min-w-0 flex-col gap-3 admin:max-h-[calc(100dvh-10rem)] admin:overflow-y-auto ${explicit ? "hidden admin:flex" : "flex"}`}>
          {!explicit && genericStatus ? (
            <div className="mb-1">
              <StatusBanner status={genericStatus} />
            </div>
          ) : null}
          {listError ? <ErrorCard label="This list" retry={retry} /> : <ListingList rows={rows} total={total} params={params} selected={selected} deepLinks={deepLinks} />}
        </div>

        <section aria-label="Listing detail" id="detail" className={`min-w-0 scroll-mt-4 ${explicit ? "block" : "hidden admin:block"}`}>
          {detailError ? (
            <ErrorCard label="This listing" retry={retry} />
          ) : missing || !detail ? (
            <div className="card p-4 admin:p-5">
              <div aria-hidden="true" className="divider-stem" />
              <p className="mt-3 font-serif text-[17px] leading-[1.6]">
                {missing ? "That listing is gone." : rows.length === 0 ? "No listings match these filters." : "Select a listing to inspect it."}
              </p>
              {missing ? (
                <p className="mt-2 font-sans text-[15px]">
                  <a href={listingHref({ q: params.q, chip: params.chip, seller: params.seller, variety: params.variety, show: params.show })} className="font-semibold text-link underline">
                    Back to all listings
                  </a>
                </p>
              ) : null}
            </div>
          ) : (
            <ListingDetail
              detail={detail}
              role={viewer.role}
              ctx={{ ...ctx, listing: String(detail.id) }}
              backHref={listingHref({ q: params.q, chip: params.chip, seller: params.seller, variety: params.variety, show: params.show })}
              genericStatus={genericStatus}
            />
          )}
        </section>
      </div>
    </AdminShell>
  );
}
