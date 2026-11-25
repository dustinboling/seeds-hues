import { MailIcon, PhoneIcon } from "../icons";
import { hostOf, telHref } from "../../lib/format";
import { OutboundLink } from "./OutboundLink";

/**
 * The seller contact block (seller-as-shop): the website channel plus the
 * seller's published customer-service phone and email rows. Unboxed — no
 * container, no reserved space — so every coverage level is a complete
 * composition. A channel renders if and only if its field exists; no
 * placeholders, no reserved space, no absence copy ever (the shipped "No
 * website on file" line stays exactly as-is). Ported from v2's
 * SellerContactBlock.
 *
 * Each row is ONE link (label + destination inside the one <a>): the
 * visible number/address as published, the href in dialable form for
 * tel:. Plain server-rendered links — identical with JS disabled, before
 * hydration, and in the PWA. Neither opens a new tab.
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
  const firstRowMargin = homepage ? "contact-row-first" : "contact-row-first-tight";
  return (
    <>
      {homepage ? (
        <p className="contact-website">
          <OutboundLink href={homepage} seller={slug} className="btn btn-primary">
            Visit their website ({hostOf(homepage)})
          </OutboundLink>
        </p>
      ) : (
        <p className="contact-no-website">No website on file for this seller.</p>
      )}
      {phone ? (
        <a href={telHref(phone)} className={`contact-row ${firstRowMargin}`}>
          <PhoneIcon className="contact-icon" />
          <span className="contact-label">Customer service</span>
          <span className="contact-value">{phone}</span>
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={`contact-row ${phone ? "" : firstRowMargin}`}>
          <MailIcon className="contact-icon" />
          <span className="contact-label">Customer service</span>
          <span className="contact-value">{email}</span>
        </a>
      ) : null}
    </>
  );
}
