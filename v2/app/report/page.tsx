import type { Metadata } from "next";
import Link from "next/link";
import { ReportForm } from "@/components/report/ReportForm";
import { pageMetadata } from "@/lib/seo/metadata";
import { legacySlug } from "@/lib/legacy";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Report a problem, claim or remove a farm",
  description: "Correct a listing, claim your farm’s page, or ask us to remove it. Removals are honoured within 48 hours.",
  path: "/report",
  noindex: true,
  follow: true,
});

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ReportPage({ searchParams }: Props) {
  const sp = await searchParams;
  const rawType = Array.isArray(sp.type) ? sp.type[0] : sp.type;
  const type = rawType === "claim" || rawType === "remove" ? rawType : "correct";
  const seller = legacySlug(sp.seller);
  const variety = legacySlug(sp.variety);
  // A seller in the query wins for claim/remove; a variety alone targets the variety.
  const targetType = seller && (type !== "correct" || !variety) ? "seller" : variety ? "variety" : "seller";
  const targetRef = (targetType === "seller" ? seller : variety) ?? "";
  return (
    <article className="max-w-3xl" aria-labelledby="report-title">
      <h1 id="report-title" className="text-3xl font-semibold text-leaf">
        Correct, claim or remove
      </h1>
      <p className="mt-3 text-lg">
        One form for everything: tell us what is wrong, claim your farm’s page, or ask us to take it down. Every request
        goes to a person. A removal takes the farm’s page and all its listings down within 48 hours and stops our crawler
        from visiting the farm’s site. See <Link href="/about/data">About the data</Link>.
      </p>
      <ReportForm type={type} targetType={targetType} targetRef={targetRef} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || null} />
    </article>
  );
}
