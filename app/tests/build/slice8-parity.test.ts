/**
 * Slice 8 parity crawl: serves the BUILT app against the parity dataset
 * (tests/parity/parity-catalog.ts — the production-shaped catalog) and
 * crawls EVERY URL in the segmented sitemap + the §8.4 redirect map +
 * pagination tails + error/handler probes, comparing each response against
 * the recorded snapshot (tests/parity/snapshot.ts): status, Location,
 * canonical, title, meta description, robots, JSON-LD type set.
 *
 * The Slice 5 residual risk closes here: /state/ohio?page=2 (25-seller
 * Ohio), /seller/blue-ridge-seeds?page=2, and the crop ?page=2 URLs are
 * explicit rows. The crawl report (app/parity-reports/slice8-parity-report.md)
 * is written by this suite — the committed tally + dispositions artifact.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { parityCatalogState } from "../parity/parity-catalog";
import { OUT_OF_SCOPE_DELTAS, SITE, buildSnapshot, type SnapshotRow } from "../parity/snapshot";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));
const SECRET = "slice8-parity-secret";

const STATE = parityCatalogState();
const ROWS = buildSnapshot(STATE);

const decodeHtml = (html: string): string =>
  html
    .replace(/<!--.*?-->/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const titleOf = (html: string): string | null => {
  const m = html.match(/<title>([^<]*)<\/title>/);
  return m ? decodeHtml(m[1]!) : null;
};

const canonicalOf = (html: string): string | null => {
  const m = html.match(/<link rel="canonical" href="([^"]*)"/);
  return m ? decodeHtml(m[1]!) : null;
};

const metaOf = (html: string, name: string): string | null => {
  const m = html.match(new RegExp(`<meta name="${name}" content="([^"]*)"`));
  return m ? decodeHtml(m[1]!) : null;
};

const ldTypes = (html: string): string[] =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]!) as unknown)
    .map((b) => (typeof b === "object" && b !== null ? String((b as { "@type": unknown })["@type"]) : "?"))
    .sort();

let stub!: StubApi;
let server!: ChildProcess;
let BASE = "";

interface CrawlResult {
  row: SnapshotRow;
  mismatches: string[];
}

const results: CrawlResult[] = [];

function runBuildStep(apiBase: string, script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", script], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production", FORCE_COLOR: "0", SEEDS_API_BASE: apiBase },
    });
    let output = "";
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`npm run ${script} timed out:\n${output}`));
    }, 280_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`npm run ${script} failed (code ${code}):\n${output}`));
    });
  });
}

beforeAll(async () => {
  stub = await startStubApi(STATE);
  const apiBase = `${stub.url}/api/v1`;
  await runBuildStep(apiBase, "build");
  await runBuildStep(apiBase, "build:server");
  server = await new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn("node", ["dist-server/serve.mjs"], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PORT: "0", SEEDS_API_BASE: apiBase, SEEDS_REVALIDATE_SECRET: SECRET },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`server did not print its listening line in time. stderr:\n${stderr}`));
    }, 30_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      const match = /listening on (http:\/\/\S+)/.exec(chunk.toString());
      if (match) {
        clearTimeout(timer);
        BASE = match[1]!;
        resolve(child);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`server exited before listening (code ${code}). stderr:\n${stderr}`));
    });
  });
}, 290_000);

afterAll(async () => {
  server?.kill("SIGTERM");
  await stub?.close();
});

async function crawl(row: SnapshotRow): Promise<CrawlResult> {
  const res = await fetch(`${BASE}${row.url}`, { redirect: "manual" });
  const text = await res.text();
  const mismatches: string[] = [];
  const check = (field: string, expected: string, actual: string): void => {
    if (expected !== actual) mismatches.push(`${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  };
  check("status", String(row.status), String(res.status));
  if (row.location !== undefined) check("location", row.location, res.headers.get("location") ?? "(absent)");
  if (row.canonical !== undefined) {
    check("canonical", row.canonical ?? "(absent)", canonicalOf(text) ?? "(absent)");
  }
  if (row.title !== undefined) check("title", row.title, titleOf(text) ?? "(absent)");
  if (row.description !== undefined && row.description !== null) {
    check("description", row.description, metaOf(text, "description") ?? "(absent)");
  }
  if (row.robots !== undefined) check("robots", row.robots ?? "(absent)", metaOf(text, "robots") ?? "(absent)");
  if (row.types !== undefined) check("jsonld-types", JSON.stringify([...row.types].sort()), JSON.stringify(ldTypes(text)));
  return { row, mismatches };
}

describe("parity crawl (snapshot vs built app)", () => {
  it.each(ROWS.map((row) => [row.url]))("%s", async (url) => {
    const row = ROWS.find((r) => r.url === url)!;
    const result = await crawl(row);
    results.push(result);
    expect(result.mismatches, `${url}\n${result.mismatches.join("\n")}`).toEqual([]);
  });
});

describe("crawl completeness + residual-risk closure", () => {
  it("every served sitemap URL is a snapshot row (the crawl misses nothing)", async () => {
    const index = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const files = [...index.matchAll(new RegExp(`${SITE.replace(/\./g, "\\.")}/(sitemap-[a-z-]+\\.xml)`, "g"))].map((m) => m[1]!);
    expect(files).toHaveLength(7);
    const urls = new Set(ROWS.map((r) => r.url));
    for (const file of files) {
      const segment = await (await fetch(`${BASE}/${file}`)).text();
      for (const m of segment.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const loc = m[1]!;
        expect(loc.startsWith(SITE), `sitemap loc on-site: ${loc}`).toBe(true);
        const path = loc.slice(SITE.length) || "/";
        expect(urls.has(path), `snapshot covers sitemap URL ${path}`).toBe(true);
      }
    }
  });

  it("the listed/zero-seller segmentation matches the snapshot exactly", async () => {
    const listedIds = new Set(STATE.snapshot.listings.map((l) => l.variety_id));
    const listedCount = STATE.snapshot.varieties.filter((v) => v.indexable && listedIds.has(v.id)).length;
    const zeroCount = STATE.snapshot.varieties.filter((v) => v.indexable && !listedIds.has(v.id)).length;
    const listed = await (await fetch(`${BASE}/sitemap-varieties-listed.xml`)).text();
    const zero = await (await fetch(`${BASE}/sitemap-varieties-zero-seller.xml`)).text();
    expect(listed.match(/<loc>/g)?.length ?? 0).toBe(listedCount);
    expect(zero.match(/<loc>/g)?.length ?? 0).toBe(zeroCount);
    expect(listedCount).toBeGreaterThan(0);
    expect(zeroCount).toBeGreaterThan(0);
  });

  it("the Slice 5 residual rows are in the crawl set", () => {
    const urls = new Set(ROWS.map((r) => r.url));
    expect(urls.has("/state/ohio?page=2")).toBe(true);
    expect(urls.has("/seller/blue-ridge-seeds?page=2")).toBe(true);
    expect(urls.has("/crop/sunflower?page=2")).toBe(true);
  });

  it("crawl report: written, tallied, zero residual mismatches", () => {
    const byStatus = new Map<number, number>();
    const byProof = new Map<string, number>();
    for (const row of ROWS) {
      byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);
      byProof.set(row.proof, (byProof.get(row.proof) ?? 0) + 1);
    }
    const mismatched = results.filter((r) => r.mismatches.length > 0);
    const lines: string[] = [
      "# Slice 8 parity crawl report",
      "",
      "Written by `tests/build/slice8-parity.test.ts` (deterministic — no clocks).",
      "Dataset: `tests/parity/parity-catalog.ts` (shop/hub catalog + testbloom grafts + 25-seller Ohio).",
      "Snapshot: `tests/parity/snapshot.ts` (live-recorded 2026-11-25 + v2-rule restatements).",
      "",
      "## Tally",
      "",
      `- URLs crawled: ${ROWS.length}`,
      `- Exact matches: ${ROWS.length - mismatched.length}`,
      `- Mismatches: ${mismatched.length}`,
      "",
      "By expected status:",
      "",
      ...[...byStatus.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([status, count]) => `- ${status}: ${count}`),
      "",
      "By proof:",
      "",
      ...[...byProof.entries()].sort().map(([proof, count]) => `- ${proof}: ${count}`),
      "",
      "## Row deltas (app value asserted, live value + ruling recorded)",
      "",
      ...ROWS.filter((r) => r.delta).map((r) => `- ${r.url} → ${r.delta}`),
      "",
      "## Out-of-compare-set deltas",
      "",
      ...OUT_OF_SCOPE_DELTAS.map((d) => `- ${d.surface}: live ${d.live} / app ${d.app} — ${d.ruling}`),
      "",
      "## Mismatches",
      "",
    ];
    if (mismatched.length === 0) {
      lines.push("None — every crawled URL matches its snapshot row on status, Location, canonical, title, description, robots, and JSON-LD types.");
      lines.push("");
    } else {
      for (const m of mismatched) {
        lines.push(`### ${m.row.url}`);
        lines.push("");
        for (const mm of m.mismatches) lines.push(`- ${mm}`);
        lines.push("");
      }
    }
    lines.push("## Residual-risk closure");
    lines.push("");
    lines.push("- Slice 5 residual (state page 2): /state/ohio?page=2 crawled (25-seller Ohio).");
    lines.push("- Shop page 2: /seller/blue-ridge-seeds?page=2 crawled.");
    lines.push("- Crop page 2: /crop/sunflower?page=2 (+ every >24-member crop hub) crawled.");
    lines.push("");
    mkdirSync(`${APP_ROOT}/parity-reports`, { recursive: true });
    writeFileSync(`${APP_ROOT}/parity-reports/slice8-parity-report.md`, `${lines.join("\n")}\n`);
    expect(mismatched.map((m) => m.row.url)).toEqual([]);
  });
});
