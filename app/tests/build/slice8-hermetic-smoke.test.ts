/**
 * Slice 8 repair (F1) built-artifact smoke probe: serves the BUILT app in
 * the hermetic `SEEDS_API_BASE=stub:parity` mode — the exact mode Lighthouse
 * CI uses — and asserts 200 + non-empty HTML on the five Lighthouse URLs.
 *
 * This is the fidelity gap Quinn's gate named: every other build suite
 * spawns the server with a real stub http URL, so the process-singleton
 * +data hooks resolve — only the `stub:parity` value exercises the
 * bundled server's embedded-stub translation, and on the PR #81 tree that
 * mode 500s (`TypeError: fetch failed`). The probe fails there and passes
 * on the fixed tree.
 *
 * `/api-docs` rides along as a sixth URL: its +data hook is the third
 * member of the same defect class (not a Lighthouse URL).
 *
 * The probe builds hermetically (prerender + machine files against the
 * in-process parity stub — no live reads), then moves the prerendered
 * `/` static aside before serving so `/` exercises renderPage like every
 * other URL (the static would mask a `/` data-hook regression — restored
 * in afterAll; every build suite rebuilds dist/ itself regardless).
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStubApi, type StubApi } from "../stub/api-server";
import { parityCatalogState } from "../parity/parity-catalog";

const APP_ROOT = fileURLToPath(new URL("../..", import.meta.url));

/** The five Lighthouse URLs, in .lighthouserc.json order, plus /api-docs (same defect class). */
const SMOKE_URLS = ["/", "/variety", "/seller", "/crop", "/search", "/api-docs"];

const PRERENDERED_HOME = `${APP_ROOT}/dist/client/index.html`;
const PRERENDERED_HOME_PARKED = `${APP_ROOT}/dist/client/index.html.smoke-parked`;

let stub!: StubApi;
let server!: ChildProcess;
let BASE = "";

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
  stub = await startStubApi(parityCatalogState());
  const apiBase = `${stub.url}/api/v1`;
  await runBuildStep(apiBase, "build");
  await runBuildStep(apiBase, "build:server");
  // Force `/` through renderPage (see header): the prerendered static
  // would otherwise mask a `/` data-hook regression.
  if (existsSync(PRERENDERED_HOME)) renameSync(PRERENDERED_HOME, PRERENDERED_HOME_PARKED);
  server = await new Promise<ChildProcess>((resolve, reject) => {
    const child = spawn("node", ["dist-server/serve.mjs"], {
      cwd: APP_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      // The hermetic mode: no PORT (ephemeral, parsed below), the literal
      // stub:parity value LHCI passes — the server translates it.
      env: { ...process.env, PORT: "0", SEEDS_API_BASE: "stub:parity" },
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
  if (existsSync(PRERENDERED_HOME_PARKED)) renameSync(PRERENDERED_HOME_PARKED, PRERENDERED_HOME);
});

describe("hermetic stub:parity serve smoke", () => {
  it.each(SMOKE_URLS.map((u) => [u]))("%s answers 200 with non-empty HTML", async (url) => {
    const res = await fetch(`${BASE}${url}`, { redirect: "manual" });
    expect(res.status, url).toBe(200);
    expect(res.headers.get("content-type"), `${url} content-type`).toContain("text/html");
    const text = await res.text();
    expect(text, `${url} non-empty HTML`).toContain("<html");
    expect(Buffer.byteLength(text, "utf8"), `${url} substantial body`).toBeGreaterThan(1000);
  });
});
