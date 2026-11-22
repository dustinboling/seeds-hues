/**
 * Varieties section (Slice C, spec §7 F1–F3): the working list + variety detail, with
 * the segmented Varieties | Crops head. Master–detail on iPad/desktop (360px list
 * column + F2 in the pane); list screen on phones (tap → detail, with a back link).
 * The Crops tab is orientation only — tapping a crop filters F1 to it. Writes post to
 * the session-authorized actions handler and land back here with their status wording.
 */
import type { Metadata } from "next";
import { adminPageData } from "@/lib/admin-current-user";
import { getServices } from "@/lib/services/context";
import { firstParam } from "@/lib/admin-auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { StatusBanner } from "@/app/admin/(protected)/review/_components/status-banner";
import { parseVarietyListParams, varietyStatusLine } from "@/lib/admin/varieties";
import { VarietyList } from "./_components/variety-list";
import { VarietyDetail } from "./_components/variety-detail";
import { CropList } from "./_components/crop-list";
import { varietyHref } from "./_components/urls";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Varieties" };

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

export default async function AdminVarietiesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const params = parseVarietyListParams({ tab: firstParam(sp.tab), q: firstParam(sp.q), crop: firstParam(sp.crop), show: firstParam(sp.show) });
  const explicit = firstParam(sp.variety);
  const returnTo = varietyHref({ tab: params.tab, variety: explicit, q: params.q, crop: params.crop, show: params.show });
  const { viewer, totalWaiting } = await adminPageData(returnTo);
  const services = await getServices();
  const retry = returnTo;
  const cropsTab = params.tab === "crops";

  // ─── crops (F3, orientation only) ──────────────────────────────────────────
  let cropRows: Awaited<ReturnType<typeof services.adminVarieties.listCrops>> = [];
  let cropsError = false;
  try {
    cropRows = await services.adminVarieties.listCrops();
  } catch {
    cropsError = true;
  }

  // ─── list pane ─────────────────────────────────────────────────────────────
  let rows: Awaited<ReturnType<typeof services.adminVarieties.listVarieties>>["rows"] = [];
  let total = 0;
  let listError = false;
  if (!cropsTab && !cropsError) {
    try {
      const list = await services.adminVarieties.listVarieties(params);
      rows = list.rows;
      total = list.total;
    } catch {
      listError = true;
    }
  }

  // ─── selection: the deep link wins; otherwise the first row fills the pane ──
  const selected = explicit ?? rows[0]?.slug ?? null;
  let detail: Awaited<ReturnType<typeof services.adminVarieties.detail>> = null;
  let detailError = false;
  let missing = false;
  if (!cropsTab && !listError && !cropsError && selected) {
    try {
      detail = await services.adminVarieties.detail(selected);
      if (!detail) missing = true;
    } catch {
      detailError = true;
    }
  }

  // ─── status wording (the actions handler only ever emits known codes) ───────
  const genericStatus = varietyStatusLine({ status: firstParam(sp.status), name: firstParam(sp.name) });
  const ctx = { variety: selected ?? "", tab: params.tab, q: params.q, crop: params.crop, show: String(params.show) };
  const cropOptions = cropRows.map((c) => ({ slug: c.slug, commonName: c.commonName }));

  return (
    <AdminShell viewer={viewer} section="varieties" reviewTotal={totalWaiting}>
      <h1 className="text-[28px] font-semibold leading-[1.15]">Varieties</h1>
      <div role="group" aria-label="Varieties section" className="mt-3 flex flex-wrap gap-2">
        <a href={varietyHref({ variety: explicit, q: params.q, crop: params.crop, show: params.show })} aria-current={!cropsTab ? "true" : undefined} className="chip-filter">
          Varieties
        </a>
        <a href={varietyHref({ tab: "crops" })} aria-current={cropsTab ? "true" : undefined} className="chip-filter">
          Crops
        </a>
      </div>

      {cropsTab ? (
        <div className="mt-4">{cropsError ? <ErrorCard label="This list" retry={retry} /> : <CropList rows={cropRows} />}</div>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 admin:grid-cols-[360px_minmax(0,1fr)]">
          <div className={`min-w-0 flex-col gap-3 admin:max-h-[calc(100dvh-10rem)] admin:overflow-y-auto ${explicit ? "hidden admin:flex" : "flex"}`}>
            {!explicit && genericStatus ? (
              <div className="mb-1">
                <StatusBanner status={genericStatus} />
              </div>
            ) : null}
            {listError || cropsError ? (
              <ErrorCard label="This list" retry={retry} />
            ) : (
              <VarietyList rows={rows} total={total} params={{ q: params.q, crop: params.crop, show: params.show }} selected={selected} crops={cropOptions} />
            )}
          </div>

          <section aria-label="Variety detail" id="detail" className={`min-w-0 scroll-mt-4 ${explicit ? "block" : "hidden admin:block"}`}>
            {detailError ? (
              <ErrorCard label="This variety" retry={retry} />
            ) : missing || !detail ? (
              <div className="card p-4 admin:p-5">
                <div aria-hidden="true" className="divider-stem" />
                <p className="mt-3 font-serif text-[17px] leading-[1.6]">
                  {missing ? "That variety is gone." : rows.length === 0 ? "No varieties match these filters." : "Select a variety to inspect it."}
                </p>
                {missing ? (
                  <p className="mt-2 font-sans text-[15px]">
                    <a href={varietyHref({ q: params.q, crop: params.crop, show: params.show })} className="font-semibold text-link underline">
                      Back to all varieties
                    </a>
                  </p>
                ) : null}
              </div>
            ) : (
              <VarietyDetail
                detail={detail}
                role={viewer.role}
                ctx={{ ...ctx, variety: detail.slug }}
                backHref={varietyHref({ q: params.q, crop: params.crop, show: params.show })}
                genericStatus={genericStatus}
              />
            )}
          </section>
        </div>
      )}
    </AdminShell>
  );
}
