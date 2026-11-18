/**
 * Auto-drafted farm summary (brief #3 addendum) against LOCAL HTML fixtures (tests/fixtures/
 * farm-site) served by a stub fetch — nothing leaves the process. Proves: evidence-quote
 * validation keeps a backed claim and drops an unbacked one; suggestions sit beside (never over)
 * the submitted values; the honest UA, robots.txt and ≥ 2 s pacing; and the failure path (fetch
 * error / robots-denied → draft_status failed + note, the submission itself unaffected).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestD1, type TestD1 } from "../helpers/d1";
import { createServices, type Services } from "@/lib/services";
import { TURNSTILE_TEST_KEYS } from "@/lib/turnstile";
import { BOT_USER_AGENT } from "@/lib/config";
import {
  fetchFarmPages,
  htmlToText,
  MIN_REQUEST_GAP_MS,
  ruleDrafter,
  runFarmSummary,
  runQueuedFarmSummaries,
  suggestFields,
  validateClaims,
  type Drafter,
} from "@/lib/services/farm-summary";

const FIX = join(process.cwd(), "tests/fixtures/farm-site");
const file = (n: string) => readFileSync(join(FIX, n), "utf8");
const SITE = "https://fixture-farm.example";

function fixtureFetch(opts: { robots?: string; fail?: boolean } = {}) {
  const calls: { url: string; ua: string | null }[] = [];
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, ua: new Headers(init?.headers).get("user-agent") });
    if (opts.fail) throw new Error("getaddrinfo ENOTFOUND fixture-farm.example");
    const path = new URL(url).pathname;
    const html = { "Content-Type": "text/html; charset=utf-8" };
    if (path === "/robots.txt") return new Response(opts.robots ?? file("robots.txt"), { headers: { "Content-Type": "text/plain" } });
    if (path === "/") return new Response(file("index.html"), { headers: html });
    if (path === "/our-story") return new Response(file("our-story.html"), { headers: html });
    return new Response("not found", { status: 404 });
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const noSleep = { sleeps: [] as number[], sleep: async (ms: number) => void noSleep.sleeps.push(ms) };

let t: TestD1;
let s: Services;
beforeAll(async () => {
  t = await createTestD1({ seed: false });
  s = createServices(t.db, {
    turnstileSecret: TURNSTILE_TEST_KEYS.secretKey,
    turnstileFetch: (async () => Response.json({ success: true })) as unknown as typeof fetch,
  });
});
afterAll(async () => {
  await t?.dispose();
});

async function submission(website = SITE) {
  const r = await s.farms.submit(
    {
      farm_name: "Fixture Flower Farm",
      contact_name: "Fran",
      contact_email: "fran@fixture-farm.example",
      city: "Junction City",
      state: "OR",
      website,
      about: "Cut flowers and seed.",
      varieties: "Zinnia — Dearest Sunset",
      authorized: true,
      business_phone: "541-555-0199",
      turnstile_token: "XXXX.DUMMY.TOKEN.XXXX",
    },
    null,
    null,
  );
  return r.id;
}
const row = async (id: number) => (await t.env.DB.prepare("SELECT * FROM farm_submissions WHERE id = ?").bind(id).first<Record<string, unknown>>())!;

describe("fetching the farm's site", () => {
  it("robots.txt first, then the homepage and the linked About page — honest UA, ≥ 2 s apart", async () => {
    const { fn, calls } = fixtureFetch();
    noSleep.sleeps.length = 0;
    const pages = await fetchFarmPages(SITE, { fetchFn: fn, sleep: noSleep.sleep });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(["/robots.txt", "/", "/our-story"]);
    for (const c of calls) expect(c.ua).toBe(BOT_USER_AGENT);
    expect(noSleep.sleeps).toEqual([MIN_REQUEST_GAP_MS, MIN_REQUEST_GAP_MS]);
    expect(pages.map((p) => p.url)).toEqual([`${SITE}/`, `${SITE}/our-story`]);
    expect(pages[0]!.text).not.toContain("tracking");
    expect(htmlToText("<p>Seeds &amp; flowers&nbsp;—&#8217;s</p>")).toBe("Seeds & flowers —’s");
  });
});

describe("evidence-quote validation", () => {
  it("drops a claim whose quote is not in the fetched text; keeps a backed one", async () => {
    const { fn } = fixtureFetch();
    const pages = await fetchFarmPages(SITE, { fetchFn: fn, sleep: noSleep.sleep });
    const backed = { claim: "Fixture Flower Farm grows cut flowers in Eugene, Oregon.", quote: "We are a small cut flower farm based in Eugene, Oregon.", url: `${SITE}/` };
    const unbacked = { claim: "The farm ships seed worldwide.", quote: "We ship seed to over 40 countries.", url: `${SITE}/` };
    const wrongPage = { claim: "Founded in 2014.", quote: "was established in 2014", url: `${SITE}/` }; // true, but quoted from the wrong URL
    const { kept, dropped } = validateClaims([backed, unbacked, wrongPage], pages);
    expect(kept).toEqual([backed]);
    expect(dropped).toEqual([unbacked, wrongPage]);
  });

  it("runFarmSummary stores only the surviving claims as the DRAFT; suggestions never overwrite submitted values", async () => {
    const id = await submission();
    const { fn } = fixtureFetch();
    const drafter: Drafter = ({ pages }) => [
      { claim: "Fixture Flower Farm is a small cut-flower farm in Eugene, Oregon.", quote: "We are a small cut flower farm based in Eugene, Oregon.", url: pages[0]!.url },
      { claim: "It has won national awards.", quote: "Winner of the national flower award 2022.", url: pages[0]!.url },
    ];
    const r = await runFarmSummary(t.db, id, { fetchFn: fn, sleep: noSleep.sleep, drafter });
    expect(r).toMatchObject({ status: "ready", kept: 1, dropped: 1 });
    const sub = await row(id);
    expect(sub.draft_status).toBe("ready");
    expect(sub.draft_summary).toBe("Fixture Flower Farm is a small cut-flower farm in Eugene, Oregon.");
    expect(JSON.parse(String(sub.draft_evidence))).toEqual([
      { claim: "Fixture Flower Farm is a small cut-flower farm in Eugene, Oregon.", quote: "We are a small cut flower farm based in Eugene, Oregon.", url: `${SITE}/` },
    ]);
    expect(String(sub.draft_note)).toMatch(/1 claim\(s\) dropped/);
    expect(JSON.parse(String(sub.suggested_fields))).toEqual({
      city: "Eugene",
      state: "OR",
      instagram: "https://www.instagram.com/fixtureflowerfarm/",
      tiktok: "https://www.tiktok.com/@fixtureflowers",
      facebook: "https://www.facebook.com/fixtureflowerfarm",
      business_phone: "5415550142",
    });
    // Submitted values untouched; nothing published.
    expect(sub).toMatchObject({ city: "Junction City", state: "OR", business_phone: "5415550199", instagram_url: null, status: "pending", seller_id: null });
  });

  it("the built-in rule drafter writes 2–4 own-words sentences, every one backed by a verbatim quote", async () => {
    const { fn } = fixtureFetch();
    const pages = await fetchFarmPages(SITE, { fetchFn: fn, sleep: noSleep.sleep });
    const claims = await ruleDrafter({ farmName: "Fixture Flower Farm", pages });
    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(claims.length).toBeLessThanOrEqual(4);
    expect(validateClaims(claims, pages).dropped).toEqual([]);
    for (const c of claims) expect(c.claim).not.toBe(c.quote); // our words, not the farm's
    expect(claims[0]).toMatchObject({ claim: "Fixture Flower Farm is based in Eugene, Oregon." });
    expect(suggestFields(pages).city).toBe("Eugene");
  });
});

describe("failure path", () => {
  it("unreachable site → draft_status failed + note; the submission proceeds (still pending)", async () => {
    const id = await submission("https://unreachable-farm.example");
    const r = await runFarmSummary(t.db, id, { fetchFn: fixtureFetch({ fail: true }).fn, sleep: noSleep.sleep });
    expect(r.status).toBe("failed");
    const sub = await row(id);
    expect(sub).toMatchObject({ draft_status: "failed", status: "pending", draft_summary: null });
    expect(String(sub.draft_note)).toMatch(/^unreachable: /);
  });

  it("robots.txt disallowing HuesSeedFinderBot → failed (robots_denied), no page fetched", async () => {
    const id = await submission();
    const f = fixtureFetch({ robots: "User-agent: HuesSeedFinderBot\nDisallow: /\n" });
    await runFarmSummary(t.db, id, { fetchFn: f.fn, sleep: noSleep.sleep });
    expect(f.calls.map((c) => new URL(c.url).pathname)).toEqual(["/robots.txt"]);
    expect(await row(id)).toMatchObject({ draft_status: "failed", status: "pending" });
    expect(String((await row(id)).draft_note)).toMatch(/^robots_denied/);
  });

  it("the queue worker runs each queued farm_summary job once and marks it done", async () => {
    const before = await t.env.DB.prepare("SELECT count(*) AS n FROM crawl_jobs WHERE type = 'farm_summary' AND status = 'queued'").first<{ n: number }>();
    expect(before!.n).toBeGreaterThan(0);
    const results = await runQueuedFarmSummaries(t.db, { fetchFn: fixtureFetch().fn, sleep: noSleep.sleep, limit: 50 });
    expect(results.length).toBe(before!.n);
    const after = await t.env.DB.prepare("SELECT count(*) AS n FROM crawl_jobs WHERE type = 'farm_summary' AND status = 'queued'").first<{ n: number }>();
    expect(after!.n).toBe(0);
  });
});
