/**
 * Auto-drafted farm profile summary (brief #3 addendum, design §9). For an Add Your Farm
 * submission with a website, fetch the farm's homepage + About page with the honest bot UA
 * (HuesSeedFinderBot), robots.txt respected, ≥ 2 s between requests, one host at a time — then
 * draft a 2–4 sentence summary IN OUR OWN WORDS as CLAIMS, each carrying a verbatim source quote
 * + source URL. Evidence discipline mirrors the ingest API: a claim whose quote is not found in
 * the fetched text of its URL (whitespace-collapsed) is DROPPED.
 *
 * Also extracts machine-SUGGESTED structured values (city, state, socials, published phone) —
 * stored as suggested_fields, shown beside the submitted values, never written over them.
 * Output is a DRAFT on the submission (draft_status ready | failed); nothing is published.
 * A failure (unreachable, blocked, robots-denied, nothing evidence-backed) records
 * draft_status = failed + draft_note; the submission itself is unaffected.
 *
 * Runs off the request path: scripts/farm-summaries.ts processes the queued "farm_summary"
 * crawl_jobs (CLI or an external cron). The Drafter is pluggable — the built-in rule drafter
 * writes templated sentences from recognisable statements; a model-backed drafter can replace
 * it behind the same claim/quote validation.
 */
import type { Db } from "@/lib/db/client";
import * as repo from "@/lib/repositories/farm-submissions";
import { BOT_NAME, BOT_USER_AGENT } from "@/lib/config";
import { robotsAllows } from "@/lib/robots";
import { normalizePhone } from "@/lib/accounts";
import { stateByCode, US_STATES } from "@/lib/data/states";

export const MIN_REQUEST_GAP_MS = 2000;
export const MAX_PAGE_CHARS = 400_000;

export interface FetchedPage {
  url: string;
  html: string;
  /** Visible text, whitespace-collapsed. */
  text: string;
}
export interface DraftClaim {
  claim: string;
  quote: string;
  url: string;
}
export type Drafter = (input: { farmName: string; pages: FetchedPage[] }) => Promise<DraftClaim[]> | DraftClaim[];

export interface SuggestedFields {
  city?: string;
  state?: string;
  instagram?: string;
  tiktok?: string;
  facebook?: string;
  business_phone?: string;
}

export class FarmFetchError extends Error {
  constructor(
    public readonly reason: "unreachable" | "blocked" | "robots_denied" | "not_html" | "bad_url",
    message: string,
  ) {
    super(message);
  }
}

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…" };

export function htmlToText(html: string): string {
  return collapse(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|section|article|header|footer|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
      .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
      .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m),
  );
}

/** Keep only claims whose quote appears verbatim (whitespace-collapsed) in the text fetched from its URL. */
export function validateClaims(claims: DraftClaim[], pages: FetchedPage[]): { kept: DraftClaim[]; dropped: DraftClaim[] } {
  const byUrl = new Map(pages.map((p) => [p.url, collapse(p.text)]));
  const kept: DraftClaim[] = [];
  const dropped: DraftClaim[] = [];
  for (const c of claims) {
    const hay = byUrl.get(c.url);
    const q = collapse(c.quote ?? "");
    const ok = Boolean(hay && q.length >= 8 && c.claim.trim().length > 0 && hay.includes(q));
    (ok ? kept : dropped).push(c);
  }
  return { kept, dropped };
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"‘'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20 && s.length <= 320);
}

/**
 * Built-in rule drafter: each rule recognises a kind of statement and writes ONE sentence in our
 * own words, quoting the sentence it relied on. At most one claim per rule, at most 4 claims.
 */
export const ruleDrafter: Drafter = ({ farmName, pages }) => {
  const rules: { re: RegExp; write: (m: RegExpExecArray) => string }[] = [
    { re: /\b(?:based|located|nestled)\s+in\s+([A-Z][A-Za-z.' -]{2,40}?,\s*(?:[A-Z]{2}\b|[A-Z][a-z]+(?: [A-Z][a-z]+)?))/, write: (m) => `${farmName} is based in ${m[1]!.trim()}.` },
    { re: /\b(?:since|established in|founded in|est\.?)\s+((?:19|20)\d{2})\b/i, write: (m) => `${farmName} has been growing since ${m[1]}.` },
    { re: /\bfamily[- ](?:owned|run|farm)\b/i, write: () => `${farmName} describes itself as a family-run farm.` },
    { re: /\b(certified organic|organically grown|organic|certified naturally grown|no[- ]spray|pesticide[- ]free)\b/i, write: (m) => `The farm describes its growing practices as ${m[1]!.toLowerCase()}.` },
    { re: /\b(?:open[- ]pollinated|heirloom|saved seed|seed saving|grow(?:n)? (?:our|their) own seed)\b/i, write: () => `${farmName} grows and saves its own seed, including heirloom or open-pollinated varieties.` },
    { re: /\b(?:cut[- ]flowers?|flower farm|specialty cut)\b/i, write: () => `${farmName} is a cut-flower farm.` },
    { re: /\b(?:sell|offer|ship)s?\b[^.]{0,80}\bseeds?\b/i, write: () => `${farmName} sells flower seed directly to gardeners.` },
  ];
  const out: DraftClaim[] = [];
  for (const rule of rules) {
    if (out.length >= 4) break;
    let hit: DraftClaim | null = null;
    for (const p of pages) {
      for (const s of sentences(p.text)) {
        const m = rule.re.exec(s);
        if (m) {
          hit = { claim: rule.write(m), quote: s, url: p.url };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) out.push(hit);
  }
  return out;
};

const STATE_NAMES = new Map(US_STATES.map((s) => [s.name.toLowerCase(), s.code]));

/** Machine-suggested structured values from the fetched pages (never authoritative). */
export function suggestFields(pages: FetchedPage[]): SuggestedFields {
  const out: SuggestedFields = {};
  const html = pages.map((p) => p.html).join("\n");
  const text = pages.map((p) => p.text).join(" ");
  const link = (re: RegExp) => re.exec(html)?.[0]?.replace(/["'<>\s].*$/, "");
  out.instagram = link(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9_.]{2,30}\/?/);
  out.tiktok = link(/https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9_.]{2,30}\/?/);
  out.facebook = link(/https?:\/\/(?:www\.|m\.)?facebook\.com\/(?!sharer|share|dialog|plugins|tr\b)[A-Za-z0-9.-]{3,60}\/?/);
  const tel = /href=["']tel:([+\d().\s-]{7,20})["']/i.exec(html)?.[1] ?? /\(?\b[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}\b/.exec(text)?.[0];
  const phone = tel ? normalizePhone(tel) : null;
  if (phone) out.business_phone = phone;
  const place = /\b([A-Z][A-Za-z.' -]{2,30}),\s*([A-Z]{2})\s+\d{5}\b/.exec(text) ?? /\b(?:based|located)\s+in\s+([A-Z][A-Za-z.' -]{2,30}),\s*([A-Z]{2}|[A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/.exec(text);
  if (place) {
    const st = place[2]!.length === 2 ? place[2]! : STATE_NAMES.get(place[2]!.toLowerCase());
    if (st && stateByCode(st)) {
      out.city = place[1]!.trim();
      out.state = st;
    }
  }
  for (const k of Object.keys(out) as (keyof SuggestedFields)[]) if (!out[k]) delete out[k];
  return out;
}

export interface FetchDeps {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

/** Fetch robots.txt, the homepage and (when linked or at a common path) the About page. */
export async function fetchFarmPages(website: string, deps: FetchDeps = {}): Promise<FetchedPage[]> {
  const f = deps.fetchFn ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let home: URL;
  try {
    home = new URL(website);
    if (!/^https?:$/.test(home.protocol)) throw new Error("protocol");
  } catch {
    throw new FarmFetchError("bad_url", `not an http(s) URL: ${website}`);
  }
  let first = true;
  const get = async (u: string) => {
    if (!first) await sleep(MIN_REQUEST_GAP_MS);
    first = false;
    try {
      return await f(u, { headers: { "User-Agent": BOT_USER_AGENT, Accept: "text/html,text/plain;q=0.9" }, redirect: "follow" });
    } catch (err) {
      throw new FarmFetchError("unreachable", `${u}: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300));
    }
  };

  const robotsRes = await get(`${home.origin}/robots.txt`);
  const robots = robotsRes.ok ? await robotsRes.text() : "";
  const allowed = (u: URL) => robotsAllows(robots, BOT_NAME, u.pathname + u.search);
  if (!allowed(home)) throw new FarmFetchError("robots_denied", `robots.txt disallows ${BOT_NAME} on ${home.pathname}`);

  const page = async (u: URL): Promise<FetchedPage | null> => {
    const res = await get(u.toString());
    if (res.status === 401 || res.status === 403 || res.status === 429) throw new FarmFetchError("blocked", `${u} answered HTTP ${res.status}`);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct && !/html|text\/plain/i.test(ct)) return null;
    const html = (await res.text()).slice(0, MAX_PAGE_CHARS);
    return { url: u.toString(), html, text: htmlToText(html) };
  };

  const homePage = await page(home);
  if (!homePage) throw new FarmFetchError("unreachable", `${home} did not return an HTML page`);
  const pages = [homePage];
  const aboutHref = [...homePage.html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ href: m[1]!, label: htmlToText(m[2]!) }))
    .find((a) => /\babout\b|our story/i.test(a.label) || /\/(about|our-story)/i.test(a.href));
  let about: URL | null = null;
  if (aboutHref) {
    try {
      const u = new URL(aboutHref.href, home);
      if (u.host === home.host) about = u;
    } catch {
      about = null;
    }
  }
  about ??= new URL("/about", home);
  if (about.toString() !== home.toString() && allowed(about)) {
    const a = await page(about).catch((err: unknown) => {
      if (err instanceof FarmFetchError && err.reason === "unreachable") return null;
      throw err;
    });
    if (a) pages.push(a);
  }
  return pages;
}

export interface FarmSummaryDeps extends FetchDeps {
  drafter?: Drafter;
  now?: () => Date;
}

/** Run the draft job for one submission; records the outcome on the submission. */
export async function runFarmSummary(db: Db, submissionId: number, deps: FarmSummaryDeps = {}) {
  const now = deps.now ?? (() => new Date());
  const sub = await repo.farmSubmissionById(db, submissionId);
  if (!sub) return { id: submissionId, status: "missing" as const };
  try {
    const pages = await fetchFarmPages(sub.website, deps);
    const proposed = await (deps.drafter ?? ruleDrafter)({ farmName: sub.farmName, pages });
    const { kept, dropped } = validateClaims(proposed, pages);
    const suggested = suggestFields(pages);
    const claims = kept.slice(0, 4);
    if (claims.length === 0) {
      await repo.updateFarmSubmission(db, sub.id, {
        draftStatus: "failed",
        draftNote: `no evidence-backed claims (${dropped.length} unbacked dropped)`,
        suggestedFields: JSON.stringify(suggested),
        draftedAt: now().toISOString(),
      });
      return { id: sub.id, status: "failed" as const, dropped: dropped.length };
    }
    await repo.updateFarmSubmission(db, sub.id, {
      draftStatus: "ready",
      draftSummary: claims.map((c) => c.claim.trim()).join(" "),
      draftEvidence: JSON.stringify(claims),
      suggestedFields: JSON.stringify(suggested),
      draftNote: dropped.length ? `${dropped.length} claim(s) dropped: quote not found in the fetched text` : null,
      draftedAt: now().toISOString(),
    });
    return { id: sub.id, status: "ready" as const, kept: claims.length, dropped: dropped.length };
  } catch (err) {
    const note = err instanceof FarmFetchError ? `${err.reason}: ${err.message}` : `error: ${err instanceof Error ? err.message : String(err)}`;
    await repo.updateFarmSubmission(db, sub.id, { draftStatus: "failed", draftNote: note.slice(0, 500), draftedAt: now().toISOString() });
    return { id: sub.id, status: "failed" as const, note };
  }
}

/** Process queued farm_summary jobs sequentially (one host at a time). */
export async function runQueuedFarmSummaries(db: Db, deps: FarmSummaryDeps & { limit?: number } = {}) {
  const jobs = await repo.queuedFarmSummaryJobs(db, deps.limit ?? 10);
  const results = [];
  for (const j of jobs) {
    results.push(await runFarmSummary(db, Number(j.target), deps));
    await repo.finishFarmSummaryJob(db, j.id, (deps.now ?? (() => new Date()))().toISOString());
  }
  return results;
}
