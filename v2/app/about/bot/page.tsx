import type { Metadata } from "next";
import Link from "next/link";
import { BOT_NAME, BOT_USER_AGENT } from "@/lib/config";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: `Our crawler (${BOT_NAME})`,
  description: `Identity, robots.txt compliance, rate limits and opt-out instructions for ${BOT_NAME}, the seeds.hues.flowers crawler.`,
  path: "/about/bot",
});

export default function BotPage() {
  return (
    <article className="prose-plain max-w-3xl" aria-labelledby="bot-title">
      <h1 id="bot-title" className="text-3xl font-semibold text-leaf">
        Our crawler
      </h1>
      <p className="mt-3 text-lg">
        {BOT_NAME} reads the public shop pages of farms listed in this directory to keep stock states and check dates
        current. At launch, listings are checked by hand; when automated checks start they follow every rule below.
      </p>

      <h2>User agent</h2>
      <p>
        <code className="break-all rounded bg-leaf-50 px-1.5 py-0.5 font-mono text-sm">{BOT_USER_AGENT}</code>
      </p>

      <h2>robots.txt</h2>
      <ul>
        <li>We read robots.txt before every run and cache it for 24 hours.</li>
        <li>
          A <code>Disallow</code> that applies to <code>{BOT_NAME}</code> (or to all agents) means we do not fetch that
          page. A robots.txt that answers with a server error also means no fetch.
        </li>
        <li>We only read public pages: no logins, no forms, no orders, no bypassing bot protection.</li>
      </ul>

      <h2>Rate limits</h2>
      <ul>
        <li>One request at a time per site, at least 5 seconds apart, honouring any Crawl-delay.</li>
        <li>We back off on HTTP 429 and 503, and use conditional requests so unchanged pages cost little.</li>
        <li>Where a shop offers a product feed we use it instead of crawling pages.</li>
      </ul>

      <h2>Opting out</h2>
      <p>
        Add a <code>Disallow</code> rule for <code>{BOT_NAME}</code> to your robots.txt, or use the{" "}
        <Link href="/report?type=remove">removal form</Link>. Removal requests are honoured within 48 hours and your
        domain goes on a permanent block list. See <Link href="/about/data">About the data</Link>.
      </p>

      <h2>Our own robots policy</h2>
      <p>
        This site allows search and AI crawlers. It disallows <code>/go/</code> (outbound click redirects) and the
        ingest and admin API paths. API responses carry <code>X-Robots-Tag: noindex</code>.
      </p>
    </article>
  );
}
