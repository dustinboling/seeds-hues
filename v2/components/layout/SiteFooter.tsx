import Link from "next/link";
import { CONFLICT_OF_INTEREST, OWNER_SITE_URL, TRADEMARK_DISCLAIMER } from "@/lib/config";
import { FooterStem } from "./FooterStem";
import { HuesLogo } from "./HuesLogo";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/about/data", label: "About the data" },
  { href: "/about/bot", label: "Our crawler" },
  { href: "/report", label: "Report, claim or remove" },
  { href: "/crop", label: "Crops" },
  { href: "/api-docs", label: "API" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export function SiteFooter() {
  return (
    <>
      {/* The thin stem rule (theme §3): the divider-stem motif centred above the footer, on the
          page's paper ground and outside this paper-deep <footer> element. Decorative. The stem
          is a transparent-ground vector, so it takes the page's own paper and cannot read as a
          band — the defect that removed the painted Motif B footer placement on 2026-11-19;
          Dustin directed the stem restored in its place on 2026-11-20. Where a bundle divider
          (PodDivider) is the page's final content, that bundle closes the page instead and
          FooterStem renders nothing. */}
      <FooterStem />
      <footer className="mt-4 border-t border-line bg-paper-deep pb-24 md:pb-8">
        <div className="container-page flex flex-col gap-4 py-8 text-sm text-ink-soft">
          <div className="flex items-center gap-3">
            <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer" aria-label="Hues Floral Park (opens in a new tab)" className="tap inline-flex items-center px-1 no-underline">
              <HuesLogo className="h-6 w-auto" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            <span aria-hidden="true" className="h-8 w-px shrink-0 bg-line-strong/70" />
            <p className="font-display text-base font-semibold text-ink">Seed Directory</p>
          </div>
          <p>
            Seed Directory (seeds.hues.flowers) is owned and operated by{" "}
            <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-link underline">
              Hues Floral Park
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
            .
          </p>
          <nav aria-label="Footer">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="inline-flex min-h-[44px] items-center">
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <a href="/llms.txt" className="inline-flex min-h-[44px] items-center">
                  llms.txt
                </a>
              </li>
            </ul>
          </nav>
          <p>{TRADEMARK_DISCLAIMER}</p>
          <p>{CONFLICT_OF_INTEREST}</p>
          <p>
            No prices are shown. Every listing shows its stock state as last seen and the date it was last checked.
            No checkout — every Shop button goes straight to the seller.
          </p>
        </div>
      </footer>
    </>
  );
}
