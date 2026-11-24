/**
 * The waiting-list panel under "No sellers yet" on zero-seller variety
 * pages. Ported from v2/components/variety/WaitlistBlock.tsx — the no-JS
 * floor (the alert-step join form as a plain HTML form, exactly v2's
 * pre-join fields and behavior), which is what the live page
 * server-renders. The account-aware interactive join states (status fetch,
 * in-place create-and-join, code entry, signed-in states) are Slice 6
 * scope and are not invented here: this slice renders the floor
 * faithfully, always.
 */

const WAITLIST_BLOCK_ID = "waitlist-block";

const SMS_CONSENT =
  "Message frequency varies (one text per variety when it’s found). Msg & data rates may apply. Reply STOP to end, HELP for help. Consent is not a condition of purchase.";

const FLOOR_SMS_TEXT = `We’ll text the phone number below (after a one-time code to confirm it). ${SMS_CONSENT}`;

const FLOOR_PHONE_LABEL = "Phone number (only needed for text alerts)";

export function WaitlistBlock({ varietySlug, varietyName }: { varietySlug: string; varietyName: string }) {
  return (
    <section aria-labelledby="waitlist-title" className="card waitlist-block" data-testid="waitlist-block" id={WAITLIST_BLOCK_ID}>
      <h3 id="waitlist-title" tabIndex={-1} className="waitlist-title">
        Join the waiting list — we’ll let you know when a seller lists {varietyName}.
      </h3>
      <p className="waitlist-sub">You can also choose a text alert. One alert when it’s first found; leave the list any time.</p>
      <form
        method="post"
        action="/api/v1/account/waitlist/join-form"
        className="waitlist-form"
        aria-label={`Join the waiting list for ${varietyName}`}
      >
        <p className="waitlist-account-note">Joining creates a free Seed Directory account.</p>
        <input type="hidden" name="variety" value={varietySlug} />
        <div className="waitlist-field">
          <label htmlFor="waitlist-floor-email" className="waitlist-label">
            Email
          </label>
          <input
            id="waitlist-floor-email"
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            className="field"
          />
        </div>
        <fieldset className="waitlist-channels">
          <legend className="waitlist-label">How should we tell you?</legend>
          <label className="waitlist-channel">
            <input type="radio" name="channel" value="email" id="waitlist-floor-channel-email" defaultChecked />
            <span>Email only</span>
          </label>
          <label className="waitlist-channel">
            <input
              type="radio"
              name="channel"
              value="sms"
              id="waitlist-floor-channel-sms"
              aria-describedby="waitlist-floor-sms-consent"
            />
            <span>
              Email and text
              <span id="waitlist-floor-sms-consent" className="waitlist-consent">
                {FLOOR_SMS_TEXT}
              </span>
            </span>
          </label>
        </fieldset>
        <div className="waitlist-field">
          <label htmlFor="waitlist-floor-phone" className="waitlist-label">
            {FLOOR_PHONE_LABEL}
          </label>
          <input
            id="waitlist-floor-phone"
            name="phone"
            type="tel"
            maxLength={32}
            autoComplete="tel-national"
            inputMode="tel"
            aria-describedby="waitlist-floor-phone-hint"
            className="field"
          />
          <span id="waitlist-floor-phone-hint" className="field-hint">
            US number. Your email + phone are how you sign in — there’s no password. We never show your phone number.
          </span>
        </div>
        <div>
          <button type="submit" className="btn btn-primary">
            Join the waiting list
          </button>
        </div>
      </form>
    </section>
  );
}
