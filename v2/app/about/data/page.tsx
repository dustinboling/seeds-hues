import type { Metadata } from "next";
import Link from "next/link";
import { BOT_USER_AGENT, OWNER_SITE_URL } from "@/lib/config";
import { pageMetadata } from "@/lib/seo/metadata";
import { ThemeArt } from "@/components/ui/ThemeArt";

export const metadata: Metadata = pageMetadata({
  title: "About the data",
  description:
    "How the directory collects listings, who qualifies as a seller, the source and date on every listing, how to opt out, and who owns the site.",
  path: "/about/data",
});

export default function AboutDataPage() {
  return (
    <article className="prose-plain max-w-3xl" aria-labelledby="data-title">
      <h1 id="data-title" className="text-3xl font-semibold text-leaf">
        About the data
      </h1>
      <ThemeArt name="about-data" priority className="art-frame mt-4 h-auto w-full" />
      <p className="mt-3 text-lg">
        This page explains where every listing comes from, which sellers qualify, and how a farm can correct, claim or
        remove its page.
      </p>

      <h2>How data is collected</h2>
      <ul>
        <li>
          Listings come from each approved farm’s own shop. At launch they are checked by hand; automated checks by our
          crawler follow the rules on the <Link href="/about/bot">crawler page</Link>.
        </li>
        <li>
          A listing is published automatically only when the variety name on the farm’s page matches a name we already
          know exactly, and every fact we record is quoted word for word from the stored copy of that page. Anything
          else waits for a person to review it.
        </li>
        <li>Stock states (“In stock”, “Sold out”) are as last seen on the date shown, not live availability.</li>
        <li>No prices are shown. Always confirm price and stock on the farm’s own site.</li>
      </ul>

      <h2>Who qualifies</h2>
      <p>
        A seller is a small farm or seed shop that the owner approves by hand, one at a time. Large seed companies are not
        listed. A seller does not have to grow the seed it sells — bought-in seed is listed the same way as seed the
        farm grows itself.
      </p>

      <h2>A checked date on every listing</h2>
      <p>
        Every listing shows when it was last checked. The API returns the same provenance for
        each listing: the source URL, when it was retrieved, the match method and a confidence.
      </p>

      <h2>Corrections, claims and opting out</h2>
      <p>
        Any farm can correct a listing, claim its page, or ask to be removed using the{" "}
        <Link href="/report">report form</Link>. We honour removal requests within 48 hours: the farm’s page answers
        “gone”, all its listings come down, and its domain goes on a permanent block list so our crawler never visits
        it again. To stop crawling without leaving the directory, disallow our crawler in robots.txt —{" "}
        <code className="break-all">{BOT_USER_AGENT}</code>.
      </p>

      <h2>Ratings</h2>
      <p>Farms and varieties show “Not yet rated”. We do not show stars or scores until real reviews exist, and we never invent them.</p>

      <h2>Your account data</h2>
      <p>
        If you create an account to join waiting lists, we store your name, email, phone number and ZIP code, the
        varieties you’re waiting for, and whether each alert has been sent. We use them only to sign you in, to text and
        email you when a variety you’re waiting for is found, and — as anonymous totals — to see which varieties people
        most want, so we know which farms to look for. Your phone number and ZIP code are never shown publicly; we use
        your ZIP only to work out your growing zone. Account data is never part of the public data feed, the API or the
        app download, and we never sell or share it. You can delete your account, and everything in it, from{" "}
        <Link href="/account">your account page</Link>. Farms that use Add Your Farm give us their business details for
        review; nothing is published until we’ve checked it by hand. More in our <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>Who runs this site</h2>
      <p>
        seeds.hues.flowers is owned and operated by <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer">Hues Floral Park<span className="sr-only"> (opens in a new tab)</span></a>, a flower farm that
        also buys seed from some listed sellers. Sellers do not pay for placement. If Hues ever lists its own seed, its
        seller page says so.
      </p>
    </article>
  );
}
