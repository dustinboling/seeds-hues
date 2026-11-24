import { ContactLine } from "../../../src/components/ContactLine";
import { ThemeArt } from "../../../src/components/ThemeArt";
import { CONFLICT_OF_INTEREST, TRADEMARK_DISCLAIMER } from "../../../src/site";

/**
 * /about — ported verbatim from v2/app/about/page.tsx. One standing-rule
 * spelling normalization (US spelling): "honoured" → "honored".
 */
export default function Page() {
  return (
    <article className="prose-plain" aria-labelledby="about-title">
      <h1 id="about-title">About seeds.hues.flowers</h1>
      <ThemeArt name="about-data" priority className="art-frame prose-art" />
      <p className="prose-lede">
        seeds.hues.flowers is a free directory of flower seed varieties and the US farms and seed companies that sell
        them. Search a variety, see who carries it, and follow a direct link to buy from the seller.
      </p>

      <h2>Who is listed</h2>
      <p>
        Any US seller who sells flower seed can be listed, from a small family farm to a large seed company. A seller
        does not have to grow the seed it sells. Read <a href="/about/data">About the data</a> for how listings
        are collected and checked.
      </p>

      <h2>No prices, no checkout</h2>
      <p>
        Listings show the stock state as last seen, the date checked and the source — not prices. This site doesn’t sell
        seed and never takes payment: every Shop button goes through a short redirect that counts the click (no
        cookies, no stored IP addresses) and then straight to the seller’s own shop. See <a href="/privacy">Privacy</a>.
      </p>

      <h2>Ratings</h2>
      <p>
        Sellers and varieties show “Not yet rated”. We do not display star ratings or scores until we have real, collected
        ratings, and we never copy or invent reviews.
      </p>

      <h2>Descriptions</h2>
      <p>
        Variety descriptions come from the sources on file. Where no description exists, the page shows a short
        summary built only from recorded facts — nothing is made up.
      </p>

      <h2>Corrections, claims and removal</h2>
      <p>
        Any listed seller may correct a listing, claim its page, or have it removed with the{" "}
        <a href="/report">report form</a>. Removal requests are honored within 48 hours. Contact:{" "}
        <ContactLine subject="Seller listing request" />.
      </p>

      <h2>Independence</h2>
      <p>{TRADEMARK_DISCLAIMER}</p>
      <p>{CONFLICT_OF_INTEREST}</p>

      <h2>For developers and AI tools</h2>
      <p>
        The catalogue is available as a read-only JSON API — see the <a href="/api-docs">API documentation</a> —
        and summarised for AI crawlers at <a href="/llms.txt">/llms.txt</a>. Our crawler’s identity and etiquette are
        described on the <a href="/about/bot">crawler page</a>.
      </p>
    </article>
  );
}
