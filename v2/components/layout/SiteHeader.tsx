import Link from "next/link";
import { HuesLogo } from "./HuesLogo";
import { HeaderMenu } from "./HeaderMenu";
import { PersonIcon } from "./icons";

const NAV = [
  { href: "/crop", label: "Crops" },
  { href: "/variety", label: "Varieties" },
  { href: "/seller", label: "Farms" },
  { href: "/search", label: "Search" },
];

/**
 * Header on the plate paper (theme §5): paper ground, `line` hairline, Fraunces wordmark,
 * sans nav. Both logo and wordmark link to "/" (the Seed Directory home); the path back to
 * Hues Floral Park lives in the footer. About lives in the footer, not the header nav.
 *
 * Layout contract (compact header): a single row at every width, and nothing wraps
 * (`flex-nowrap`; the right side is `flex-none`, the lockup is `min-w-0` with a truncating
 * wordmark as a safety valve only).
 * - Mobile: Hues logo at 24px (no side padding) + one-line "Seed Directory" wordmark
 *   (text-[15px]), with NO divider. No byline. This sizing exists so the full wordmark fits
 *   untruncated at 360-390px while the account and menu targets stay ≥ 44px.
 * - md: logo 44px (px-1) and the divider joins between logo and wordmark; the sans nav appears.
 * - lg: the "by Hues Floral Park" byline appears inline after the wordmark (no stem motif
 *   between them; the byline stays in the DOM below lg, hidden; it also lives in the footer).
 * - Right side, in order: the sans nav (md+), the account icon (/account), then the hamburger
 *   menu (`HeaderMenu`) at the far right; both icons keep ≥ 44px tap targets. There is no
 *   "Add Your Farm" pill in the header: Add Your Farm lives in the hamburger menu and the footer.
 * The old stacked mobile lockup and the second-row wrap of the right-side controls are gone.
 */
export function SiteHeader() {
  return (
    <header className="border-b border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="container-page flex min-h-14 flex-nowrap items-center justify-between gap-x-2 md:gap-x-4">
        <div className="flex min-w-0 items-center gap-1.5 md:gap-3">
          <Link href="/" aria-label="Seed Directory — home" className="tap inline-flex items-center px-0 no-underline md:px-1">
            <HuesLogo className="h-[24px] w-auto md:h-11" />
          </Link>
          <span aria-hidden="true" className="hidden w-px shrink-0 bg-line-strong/70 md:block md:h-10" />
          <Link href="/" className="tap flex min-w-0 items-center gap-2 text-ink no-underline hover:text-ink">
            <span className="truncate font-display text-[15px] font-semibold leading-tight tracking-[-0.02em] md:text-[1.25rem]">
              Seed Directory
            </span>
            <span className="hidden whitespace-nowrap font-sans text-sm leading-tight text-muted lg:block">by Hues Floral Park</span>
          </Link>
        </div>
        <div className="ml-auto flex flex-none items-center gap-1 md:gap-2">
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    className="tap inline-flex items-center rounded-lg px-3 font-sans font-medium text-ink no-underline transition-colors duration-150 ease-out hover:bg-leaf-50 hover:text-leaf"
                  >
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <Link
            href="/account"
            aria-label="Your account"
            className="tap inline-flex items-center justify-center rounded-full text-ink no-underline transition-colors duration-150 ease-out hover:bg-leaf-50 hover:text-leaf"
            data-testid="header-account"
          >
            <PersonIcon />
          </Link>
          <HeaderMenu />
        </div>
      </div>
    </header>
  );
}
