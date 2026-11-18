import { CONTACT_EMAIL, OWNER_SITE_URL } from "@/lib/config";

/** Contact channel for removals / opt-outs. Never invents an address (see lib/config.ts). */
export function ContactLine({ subject }: { subject: string }) {
  if (CONTACT_EMAIL) {
    return (
      <a href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`}>{CONTACT_EMAIL}</a>
    );
  }
  return (
    <>
      Hues Floral Park via <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer">
        hues.flowers
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
    </>
  );
}
