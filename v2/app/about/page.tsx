import type { Metadata } from "next";
import Link from "next/link";
import { ContactLine } from "@/components/layout/ContactLine";
import { CONFLICT_OF_INTEREST, TRADEMARK_DISCLAIMER } from "@/lib/config";
import { pageMetadata } from "@/lib/seo/metadata";
import { ThemeArt } from "@/components/ui/ThemeArt";

export const metadata: Metadata = pageMetadata({
  title: "About the directory",
  description:
    "What seeds.hues.flowers is, which sellers are listed, how ratings work, and how sellers can correct, claim or remove their listings.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <article className="prose-plain max-w-3xl" aria-labelledby="about-title">
      <h1 id="about-title" className="text-3xl font-semibold text-leaf">
        About seeds.hues.flowers
      </h1>
      <ThemeArt name="about-data" priority className="art-frame mt-4 h-auto w-full" />
      <p className="mt-3 text-lg">
        seeds.hues.flowers is a free directory of flower seed varieties and the US farms and seed companies that sell
        them, large and small. Search a variety, see who carries it, and follow a direct link to buy from the seller.
        Small family farms carry a Small farm badge, so you can choose to buy from one.
      </p>

      <h2>Who is listed</h2>
      <p>
        Any US seller who sells flower seed can be listed, from a small family farm to a large seed company. Small
        family farms carry a Small farm badge, so you can spot them and choose to buy from them. A seller does not have
        to grow the seed it sells. Read <Link href="/about/data">About the data</Link> for how listings
        are collected and checked.
      </p>

      <h2>No prices, no checkout</h2>
      <p>
        Listings show the stock state as last seen, the date checked and the source — not prices. This site doesn’t sell
        seed and never takes payment: every Shop button goes through a short redirect that counts the click (no
        cookies, no stored IP addresses) and then straight to the seller’s own shop. See <Link href="/privacy">Privacy</Link>.
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
        <Link href="/report">report form</Link>. Removal requests are honoured within 48 hours. Contact:{" "}
        <ContactLine subject="Seller listing request" />.
      </p>

      <h2>Independence</h2>
      <p>{TRADEMARK_DISCLAIMER}</p>
      <p>{CONFLICT_OF_INTEREST}</p>

      <h2>For developers and AI tools</h2>
      <p>
        The catalogue is available as a read-only JSON API — see the <Link href="/api-docs">API documentation</Link> —
        and summarised for AI crawlers at <a href="/llms.txt">/llms.txt</a>. Our crawler’s identity and etiquette are
        described on the <Link href="/about/bot">crawler page</Link>.
      </p>
    </article>
  );
}
