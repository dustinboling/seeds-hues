import { MailIcon, PhoneIcon } from "@/components/layout/icons";
import { OutboundLink } from "@/components/ui/OutboundLink";
import { hostOf, telHref } from "@/lib/format";

/**
 * The seller contact block (seller-as-shop, SPEC §3.5): the website channel plus the
 * seller's published customer-service phone and email rows. Unboxed — no container, no
 * reserved space — so every coverage level is a complete composition. A channel renders
 * if and only if its field exists; no placeholders, no reserved space, no absence copy
 * ever (the shipped "No website on file" line stays exactly as-is).
 *
 * Each row is ONE link (label + destination inside the one <a> — Ada Ruling 2): the
 * visible number/address as published, the href in dialable form for tel:. Plain
 * server-rendered links — identical with JS disabled, before hydration, and in the PWA.
 * Neither opens a new tab.
 */
export function SellerContactBlock({
  slug,
  homepage,
  phone,
  email,
}: {
  slug: string;
  homepage: string | null;
  /** The customer-service phone as published (display form); null when unpublished. */
  phone: string | null;
  /** The customer-service email in full; null when unpublished. */
  email: string | null;
}) {
  // Button → first row 8px; "No website" line → first row 4px; row → row 0.
  const firstRowMargin = homepage ? "mt-2" : "mt-1";
  return (
    <>
      {homepage ? (
        <p className="mt-4">
          <OutboundLink href={homepage} seller={slug} className="btn btn-primary">
            Visit their website ({hostOf(homepage)})
          </OutboundLink>
        </p>
      ) : (
        <p className="mt-4 text-sm text-muted">No website on file for this seller.</p>
      )}
      {phone ? (
        <a href={telHref(phone)} className={`flex min-h-target w-full items-center gap-2 ${firstRowMargin} sm:max-w-[32rem]`}>
          <PhoneIcon className="size-5 shrink-0 text-leaf-600" />
          <span className="text-base text-ink-soft">Customer service</span>
          <span className="min-w-0 break-all text-base font-semibold underline">{phone}</span>
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={`flex min-h-target w-full items-center gap-2 ${phone ? "" : firstRowMargin} sm:max-w-[32rem]`}>
          <MailIcon className="size-5 shrink-0 text-leaf-600" />
          <span className="text-base text-ink-soft">Customer service</span>
          <span className="min-w-0 break-all text-base font-semibold underline">{email}</span>
        </a>
      ) : null}
    </>
  );
}
