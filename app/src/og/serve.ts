/**
 * The /og/[kind]/[slug] route handler (server-agnostic): card copy, then a
 * 1200×630 PNG. Malformed slugs and missing records get no card (404). The
 * Node harness mounts this from serve.ts; the production Worker mounts the
 * same function.
 */
import { buildOgCard, type OgCardCatalog } from "./card";
import { renderOgPng } from "./render";

export interface OgServeDeps {
  catalog: OgCardCatalog;
  fontDir: string;
}

export interface OgServeResult {
  status: 200 | 404;
  headers: Record<string, string>;
  body: Buffer | null;
}

export async function serveOgImage(kind: string, slug: string, deps: OgServeDeps): Promise<OgServeResult> {
  const card = await buildOgCard(kind, slug, deps.catalog);
  if (!card) return { status: 404, headers: {}, body: null };
  const body = await renderOgPng(card, { fontDir: deps.fontDir });
  return {
    status: 200,
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" },
    body,
  };
}
