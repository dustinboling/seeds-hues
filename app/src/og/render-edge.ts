/**
 * OG PNG renderer for the Worker: the card element through Satori (SVG)
 * and resvg-wasm (PNG) — the same stack and the same bundled font bytes
 * as the Node renderer (render.ts), with two Worker-driven swaps: the
 * native resvg-js binding becomes its WASM twin (same resvg core
 * version, so the same SVG draws the same pixels), and Satori runs as
 * its standalone build. Both engines initialize from caller-supplied
 * precompiled WebAssembly modules — workerd disallows dynamic WASM
 * compilation ("code generation disallowed by embedder"), so the bytes
 * must arrive as modules: the Worker build imports the .wasm files
 * statically (wrangler uploads them as modules) and the test compiles
 * them in Node. The engines initialize once per isolate and are reused
 * for every card after. Server-only, like its sibling.
 */
import { createElement } from "react";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import satori, { init as initSatori } from "satori/standalone";
import { OgCardImage } from "../components/og/OgCardImage";
import { buildOgCard, type OgCard, type OgCardCatalog } from "./card";

const WIDTH = 1200;
const HEIGHT = 630;

export interface EdgeOgFonts {
  geist: ArrayBuffer;
  fraunces: ArrayBuffer;
}

/** The precompiled engine modules (Satori's layout.wasm + resvg's index_bg.wasm). */
export interface EdgeOgWasm {
  yoga: WebAssembly.Module;
  resvg: WebAssembly.Module;
}

export interface EdgeOgAssets {
  fonts: EdgeOgFonts;
  wasm: EdgeOgWasm;
}

let enginesInit: Promise<void> | null = null;

function ensureEngines(wasm: EdgeOgWasm): Promise<void> {
  enginesInit ??= (async () => {
    await initSatori(wasm.yoga);
    await initWasm(wasm.resvg);
  })();
  return enginesInit;
}

export async function renderOgPngEdge(card: OgCard, assets: EdgeOgAssets): Promise<Uint8Array> {
  await ensureEngines(assets.wasm);
  // Order matters: Geist first, so it stays Satori's default/fallback face
  // for any text without an explicit family (the Node renderer's rule).
  const svg = await satori(createElement(OgCardImage, { card }), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "geist", data: assets.fonts.geist, weight: 400, style: "normal" },
      { name: "Fraunces", data: assets.fonts.fraunces, weight: 700, style: "normal" },
    ],
  });
  const image = new Resvg(svg).render();
  const png = image.asPng();
  image.free();
  return png;
}

export interface OgServeEdgeDeps {
  catalog: OgCardCatalog;
  assets: EdgeOgAssets;
}

export interface OgServeEdgeResult {
  status: 200 | 404;
  headers: Record<string, string>;
  body: Uint8Array | null;
}

/**
 * The /og/[kind]/[slug] route handler for the Worker: card copy, then a
 * 1200×630 PNG. Malformed slugs and missing records get no card (404) —
 * the same result contract as the Node harness's serveOgImage.
 */
export async function serveOgImageEdge(kind: string, slug: string, deps: OgServeEdgeDeps): Promise<OgServeEdgeResult> {
  const card = await buildOgCard(kind, slug, deps.catalog);
  if (!card) return { status: 404, headers: {}, body: null };
  const body = await renderOgPngEdge(card, deps.assets);
  return {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    body,
  };
}
