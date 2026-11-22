import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/layout/ContactLine";
import { formatFriendlyDate } from "@/lib/format";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "What seeds.hues.flowers collects (very little), why, and what it never collects.",
  path: "/privacy",
});

const analyticsOn = Boolean(process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN?.trim());

export default function PrivacyPage() {
  return (
    <article className="prose-plain max-w-3xl" aria-labelledby="privacy-title">
      <h1 id="privacy-title" className="text-3xl font-semibold text-leaf">
        Privacy
      </h1>
      <p className="mt-3">
        You can browse the whole directory without an account, and the site carries no advertising. An account is only
        needed to join waiting lists. This page describes everything the site does with data.
      </p>
      <h2>Accounts and waiting lists</h2>
      <p>
        An account holds your name, email, phone number and ZIP code. We use them to sign you in (your email and phone
        together are your sign-in — there is no password), to send you a one-time code that confirms your email (and, if
        you choose text alerts, your alert number), and to tell you when a variety you’re waiting for is listed by a
        farm. Your phone number and ZIP code are never shown publicly; the ZIP is used only to work out your USDA growing
        zone, which only you see. Waiting-list data is used for alerts and, as anonymous totals, to see which varieties
        are most wanted. We never sell or share account data, and it is never included in the public API or data
        downloads.
      </p>
      <p>
        Text alerts are opt-in, one text per variety when it is found; reply STOP to end them. Every alert email has a
        one-click unsubscribe for that variety and for all alerts, and our emails contain no tracking pixels.
      </p>
      <p>
        You can delete your account at any time from <Link href="/account">your account page</Link>; that removes your
        account, your sign-in sessions, your waiting lists and any queued alerts. If you send us a farm through Add Your
        Farm, those business details stay in our review queue.
      </p>
      <h2>Cookies</h2>
      <p>
        The site sets one cookie of its own, and only when you sign in: <code>sf_session</code>, which keeps you signed
        in for 30 days (it holds a random token, nothing else). Sign out to remove it. Nothing is stored for tracking.
      </p>
      <h2>Human check</h2>
      <p>
        The account, sign-in, waiting-list, Add Your Farm and report forms use Cloudflare Turnstile to confirm a person is
        sending them. Turnstile runs a privacy-preserving browser check and does not set advertising cookies.
      </p>
      <h2>Outbound-click counts</h2>
      <p>
        When you follow a link to a seller, your browser sends a small background message recording which seller and
        variety link was used, the link address and the time. It contains no cookie, no account, and no identifier for
        you, and it never delays the link.
      </p>
      <h2>Analytics</h2>
      <p>
        {analyticsOn
          ? "We use Cloudflare Web Analytics, which counts page views without cookies or cross-site tracking."
          : "No analytics script is currently loaded. If we enable Cloudflare Web Analytics (cookie-free page-view counts) this page will say so."}{" "}
        No other third-party trackers are used.
      </p>
      <h2>Server logs and abuse protection</h2>
      <p>
        The site runs on Cloudflare. Like any web host, Cloudflare processes IP addresses to deliver pages, block abuse
        and enforce the API rate limit (120 requests per minute per IP). We do not store IP addresses in our database
        (failed sign-in attempts are counted against a one-way hash, never the address itself).
      </p>
      <h2>Offline copy on your device</h2>
      <p>
        If you install the app or browse with a modern browser, a service worker keeps copies of pages you have viewed
        on your device so they work offline. You can clear them at any time in your browser’s site settings.
      </p>
      <h2>Contact</h2>
      <p>
        Questions: <ContactLine subject="Privacy question" />.
      </p>
      <p className="text-sm text-muted">Last updated {formatFriendlyDate("2026-11-17")}.</p>
    </article>
  );
}
