/**
 * OG PNG renderer: the card element through Satori (SVG) and resvg (PNG) —
 * the same stack next/og runs, with the same bundled font bytes (see
 * fonts/PROVENANCE.json). Typography + color swatch + site mark only, no
 * photos, no external fetches. The title is set in the static Fraunces
 * instance (Satori cannot parse the variable TTF or WOFF2); Geist Regular
 * stays Satori's default face for everything else, exactly as v2 configures
 * it. Server-only (reads font files from disk).
 */
import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { OgCardImage } from "../components/og/OgCardImage";
import type { OgCard } from "./card";

const WIDTH = 1200;
const HEIGHT = 630;

const toArrayBuffer = (bytes: Buffer): ArrayBuffer =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

export async function renderOgPng(card: OgCard, opts: { fontDir: string }): Promise<Buffer> {
  const [geist, fraunces] = await Promise.all([
    readFile(join(opts.fontDir, "geist-regular.ttf")),
    readFile(join(opts.fontDir, "fraunces-og.ttf")),
  ]);
  // Order matters: Geist first, so it stays Satori's default/fallback face
  // for any text without an explicit family.
  const svg = await satori(createElement(OgCardImage, { card }), {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      { name: "geist", data: toArrayBuffer(geist), weight: 400, style: "normal" },
      { name: "Fraunces", data: toArrayBuffer(fraunces), weight: 700, style: "normal" },
    ],
  });
  return Buffer.from(new Resvg(svg).render().asPng());
}
