/**
 * Preview Worker: the edge OG renderer (Satori + resvg-wasm, the
 * Worker-safe half of the /og/[kind]/[slug] route). The Node harness
 * renders with resvg-js (a native binding — it cannot load in workerd);
 * this module renders the same card element with the same resvg core
 * version through WASM, from caller-supplied font + wasm bytes (the
 * Worker build inlines them; the test reads them from disk).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildOgCard } from "../../src/og/card";
import { renderOgPng } from "../../src/og/render";
import { renderOgPngEdge, serveOgImageEdge, type EdgeOgAssets } from "../../src/og/render-edge";

const FONTS = fileURLToPath(new URL("../../src/og/fonts", import.meta.url));
const YOGA_WASM = fileURLToPath(new URL("../../node_modules/satori/layout.wasm", import.meta.url));
const RESVG_WASM = fileURLToPath(new URL("../../node_modules/@resvg/resvg-wasm/index_bg.wasm", import.meta.url));

const toArrayBuffer = (bytes: Buffer): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const assets = (): EdgeOgAssets => ({
  fonts: {
    geist: toArrayBuffer(readFileSync(`${FONTS}/geist-regular.ttf`)),
    fraunces: toArrayBuffer(readFileSync(`${FONTS}/fraunces-og.ttf`)),
  },
  // Node compiles dynamically — the same modules the Worker build
  // imports statically (wrangler uploads them precompiled).
  wasm: {
    yoga: new WebAssembly.Module(readFileSync(YOGA_WASM)),
    resvg: new WebAssembly.Module(readFileSync(RESVG_WASM)),
  },
});

const nullCatalog = {
  getVarietyDetail: async () => null,
  ogSeller: async () => null,
  ogCrop: async () => null,
};

const pngDims = (png: Uint8Array): { width: number; height: number } => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

describe("renderOgPngEdge", () => {
  it("renders a deterministic 1200x630 PNG for the fallback card", async () => {
    const card = await buildOgCard("site", "default", nullCatalog);
    expect(card).not.toBeNull();
    const first = await renderOgPngEdge(card!, assets());
    expect([...first.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(pngDims(first)).toEqual({ width: 1200, height: 630 });
    const second = await renderOgPngEdge(card!, assets());
    expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
  }, 60_000);

  it("draws byte-identical pixels to the Node renderer (same resvg core)", async () => {
    const card = await buildOgCard("site", "default", nullCatalog);
    const node = await renderOgPng(card!, { fontDir: FONTS });
    const edge = await renderOgPngEdge(card!, assets());
    expect(Buffer.from(edge).equals(node)).toBe(true);
  }, 60_000);
});

describe("serveOgImageEdge", () => {
  it("serves the card with the route's cache lifetime, or 404 without one", async () => {
    const hit = await serveOgImageEdge("site", "default", { catalog: nullCatalog, assets: assets() });
    expect(hit.status).toBe(200);
    expect(hit.headers["Content-Type"]).toBe("image/png");
    expect(hit.headers["Cache-Control"]).toBe("public, max-age=86400, stale-while-revalidate=604800");
    expect(hit.body).not.toBeNull();
    expect(pngDims(hit.body!)).toEqual({ width: 1200, height: 630 });
    const miss = await serveOgImageEdge("variety", "no-such-slug", { catalog: nullCatalog, assets: assets() });
    expect(miss).toEqual({ status: 404, headers: {}, body: null });
  }, 60_000);
});
