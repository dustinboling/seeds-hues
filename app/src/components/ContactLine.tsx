import { OWNER_SITE_URL } from "../site";

/**
 * Contact channel for removals / opt-outs. Never invents an address: when the
 * SEEDS_CONTACT_EMAIL build-time value is set it renders a mailto link,
 * otherwise it directs people to Hues Floral Park (the live behavior —
 * production sets no address).
 */
export function ContactLine({ subject }: { subject: string }) {
  const email = import.meta.env.VITE_SEEDS_CONTACT_EMAIL?.trim() || null;
  if (email) {
    return <a href={`mailto:${email}?subject=${encodeURIComponent(subject)}`}>{email}</a>;
  }
  return (
    <>
      Hues Floral Park via{" "}
      <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer">
        hues.flowers
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </>
  );
}
