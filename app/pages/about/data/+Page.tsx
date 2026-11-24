import { ThemeArt } from "../../../src/components/ThemeArt";
import { BOT_USER_AGENT, OWNER_SITE_URL } from "../../../src/site";

/**
 * /about/data — ported verbatim from v2/app/about/data/page.tsx. One standing-rule
 * spelling normalization (US spelling, same as the gated /about): "honour" → "honor".
 */
export default function Page() {
  return (
    <article className="prose-plain" aria-labelledby="data-title">
      <h1 id="data-title">About the data</h1>
      <ThemeArt name="about-data" priority className="art-frame prose-art" />
      <p className="prose-lede">
        This page explains where every listing comes from, which sellers are listed, and how a seller can correct, claim
        or remove its page.
      </p>

      <h2>How data is collected</h2>
      <ul>
        <li>
          Listings come from each seller’s own shop. At launch they are checked by hand; automated checks by our
          crawler follow the rules on the <a href="/about/bot">crawler page</a>.
        </li>
        <li>
          A listing is published automatically only when the variety name on the seller’s page matches a name we already
          know exactly, and every fact we record is quoted word for word from the stored copy of that page. Anything
          else waits for a person to review it.
        </li>
        <li>Stock states (“In stock”, “Sold out”) are as last seen on the date shown, not live availability.</li>
        <li>No prices are shown. Always confirm price and stock on the seller’s own site.</li>
      </ul>

      <h2>Who is listed</h2>
      <p>
        Any US farm or seed company that sells flower seed can be listed, whatever its size. Small family farms carry a
        Small farm badge — our judgment call, not a formal test — so shoppers can spot them and choose to buy from them.
        A seller does not have to grow the seed it sells — bought-in seed is listed the same way as seed the seller
        grows itself.
      </p>

      <h2>A checked date on every listing</h2>
      <p>
        Every listing shows when it was last checked. The API returns the same provenance for
        each listing: the source URL, when it was retrieved, the match method and a confidence.
      </p>

      <h2>Corrections, claims and opting out</h2>
      <p>
        Any seller can correct a listing, claim its page, or ask to be removed using the{" "}
        <a href="/report">report form</a>. We honor removal requests within 48 hours: the seller’s page answers
        “gone”, all its listings come down, and its domain goes on a permanent block list so our crawler never visits
        it again. To stop crawling without leaving the directory, disallow our crawler in robots.txt —{" "}
        <code>{BOT_USER_AGENT}</code>.
      </p>

      <h2>Ratings</h2>
      <p>Sellers and varieties show “Not yet rated”. We do not show stars or scores until real reviews exist, and we never invent them.</p>

      <h2>Your account data</h2>
      <p>
        If you create an account to join waiting lists, we store your name, email, phone number and ZIP code, the
        varieties you’re waiting for, and whether each alert has been sent. We use them only to sign you in, to text and
        email you when a variety you’re waiting for is found, and — as anonymous totals — to see which varieties people
        most want, so we know which sellers to look for. Your phone number and ZIP code are never shown publicly; we use
        your ZIP only to work out your growing zone. Account data is never part of the public data feed, the API or the
        app download, and we never sell or share it. You can delete your account, and everything in it, from{" "}
        <a href="/account">your account page</a>. Farms that use Add Your Farm give us their business details for
        review; nothing is published until we’ve checked it by hand. More in our <a href="/privacy">privacy notice</a>.
      </p>

      <h2>Who runs this site</h2>
      <p>
        seeds.hues.flowers is owned and operated by <a href={OWNER_SITE_URL} target="_blank" rel="noopener noreferrer">Hues Floral Park<span className="sr-only"> (opens in a new tab)</span></a>, a flower farm that
        also buys seed from some listed sellers. Sellers do not pay for placement.
      </p>
    </article>
  );
}
