/**
 * Slice 3 preview/test server (Node): serves the BUILT app (dist/client +
 * dist/server) over plain HTTP so the contract suite drives the real SSR
 * path — Vike renderPage — with no JavaScript, Quinn-style.
 *
 * Responsibilities (production Worker/router concerns, mirrored 1:1 here):
 * - static files from dist/client (assets, manifest, machine files);
 * - POST /internal/revalidate (Bearer secret, the revalidate-handler mount
 *   contract): purges the shared data cache AND the edge mock, returns paths;
 * - /og/[kind]/[slug] image responses (the src/og route handler);
 * - everything else through Vike renderPage with the shared CatalogApi +
 *   DataCache passed via pageContextInit — ONE instance per process, so the
 *   revalidate purge reaches the same cache the +data hooks read (a second
 *   bundle copy would make the purge silently miss);
 * - a minimal in-memory edge mock for the detail routes' 200s
 *   (/variety/*, /seller/*, /crop/*, /series/*, /state/*), keyed per the
 *   §9 contract (the ?small_farm=true variant and every filtered/paged
 *   view keys separately, so a variant can never serve as the clean
 *   page), purged by the revalidate paths plus the purged entries'
 *   related paths. Only 200s are stored; redirects and errors bypass.
 *
 * Env: PORT (0 = ephemeral; the listening URL prints on stdout),
 * SEEDS_API_BASE (default: the live API), SEEDS_REVALIDATE_SECRET
 * (required for POST /internal/revalidate).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { renderPage } from "vike/server";
import { createCatalogApi } from "../src/data/api";
import { createDataCache } from "../src/data/cache";
import { serveOgImage } from "../src/og/serve";
import { handleRevalidateHttpRequest } from "../src/server/revalidate-handler";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const CLIENT_DIST = join(ROOT, "dist", "client");
const OG_FONTS_DIR = process.env.OG_FONTS_DIR ?? join(ROOT, "dist-server", "fonts");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".ico": "image/x-icon",
};

interface EdgeEntry {
  status: number;
  headers: [string, string][];
  body: string;
}

/**
 * Edge key for a variety URL: the pathname plus the variant marker when the
 * forgiving parse is on (?small_farm=true exactly once). All other query
 * strings are ignored — the route renders identically without them.
 */
function edgeKey(pathname: string, search: string): string {
  const values = new URLSearchParams(search).getAll("small_farm");
  const variant = values.length === 1 && values[0] === "true";
  return variant ? `${pathname}?small_farm=true` : pathname;
}

/** Single-segment shop/hub detail paths (the browse indexes stay uncached, Slice 4's rule). */
const DETAIL_PATTERN = /^\/(?:seller|crop|series|state)\/[^/]+$/;

/**
 * Edge key for a shop/hub URL: the pathname plus the FULL query string.
 * Every filtered, searched, sorted, and paged view keys separately from
 * the clean page (and from each other), so a variant can never serve as
 * the clean page — at the cost of one entry per distinct URL.
 */
function detailKey(pathname: string, search: string): string {
  return search ? `${pathname}${search}` : pathname;
}

/**
 * Drop an edge entry and every variant keyed under its pathname (a page's
 * filtered/paged views purge with the page itself).
 */
function purgeEdge(edge: Map<string, EdgeEntry>, path: string): void {
  edge.delete(path);
  for (const key of [...edge.keys()]) {
    if (key.startsWith(`${path}?`)) edge.delete(key);
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length > 0 ? (JSON.parse(text) as unknown) : null;
}

async function main(): Promise<void> {
  const apiBaseUrl = (process.env.SEEDS_API_BASE ?? "https://seeds.hues.flowers/api/v1").replace(/\/+$/, "");
  const secret = process.env.SEEDS_REVALIDATE_SECRET ?? "";
  // The process's ONE catalog client + data cache, shared by every render
  // (via pageContextInit) and every revalidate POST (inline purge).
  const api = createCatalogApi({ baseUrl: apiBaseUrl });
  const cache = createDataCache();
  const edge = new Map<string, EdgeEntry>();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://app");
      const pathname = url.pathname;

      if (req.method === "POST" && pathname === "/internal/revalidate") {
        if (!secret) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "revalidate not configured: set SEEDS_REVALIDATE_SECRET" }));
          return;
        }
        const body = await readJsonBody(req);
        try {
          // Capture related-entity paths BEFORE the data purge deletes the
          // entries that register them (a seller tag drops the variety
          // pages behind its listings even though the tag names only its
          // own — relatedPaths after invalidate would see an empty cache).
          let related: string[] = [];
          const result = await handleRevalidateHttpRequest(
            { authorization: req.headers.authorization ?? null, body },
            {
              expectedSecret: secret,
              invalidatePaths: (paths) => {
                related = cache.relatedPaths(paths);
                return cache.invalidatePaths(paths);
              },
            },
          );
          // The tag's own paths plus the purged entries' related-entity
          // paths (a one-tag revalidate drops every affected page even
          // though the tag names only its own — e.g. a seller tag drops
          // the variety pages behind its listings).
          for (const p of new Set([...result.paths, ...related])) purgeEdge(edge, p);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(result));
        } catch (error) {
          const auth = error instanceof Error && error.name === "RevalidateAuthError";
          const validation = error instanceof Error && error.name === "RevalidateValidationError";
          res.writeHead(auth ? 401 : validation ? 400 : 500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: error instanceof Error ? error.message : "revalidate failed" }));
        }
        return;
      }

      const og = /^\/og\/([^/]+)\/([^/]+)$/.exec(pathname);
      if (og && (req.method === "GET" || req.method === "HEAD")) {
        const result = await serveOgImage(og[1]!, og[2]!, { catalog: api, fontDir: OG_FONTS_DIR });
        if (result.status === 404 || !result.body) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }
        res.writeHead(200, result.headers);
        res.end(req.method === "HEAD" ? undefined : result.body);
        return;
      }

      if (req.method === "GET" || req.method === "HEAD") {
        const filePath = normalize(join(CLIENT_DIST, pathname === "/" ? "index.html" : `.${pathname}`));
        if (filePath.startsWith(CLIENT_DIST)) {
          try {
            const body = await readFile(filePath);
            res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream" });
            res.end(req.method === "HEAD" ? undefined : body);
            return;
          } catch {
            // Not a static file — fall through to the renderer.
          }
        }
      }

      // Edge mock: serve a stored detail 200, else render and maybe store.
      const cacheable = req.method === "GET" && (pathname.startsWith("/variety/") || DETAIL_PATTERN.test(pathname));
      const key = cacheable
        ? pathname.startsWith("/variety/")
          ? edgeKey(pathname, url.search)
          : detailKey(pathname, url.search)
        : null;
      const hit = key ? edge.get(key) : undefined;
      if (hit) {
        res.writeHead(hit.status, Object.fromEntries(hit.headers));
        res.end(hit.body);
        return;
      }

      const pageContext = await renderPage({ urlOriginal: req.url ?? "/", catalogApi: api, dataCache: cache });
      const { httpResponse } = pageContext;
      const body = await httpResponse.getBody();
      const headers = new Headers(httpResponse.headers);
      if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
      const headerList = [...headers.entries()] as [string, string][];
      if (key && httpResponse.statusCode === 200) {
        edge.set(key, { status: 200, headers: headerList, body });
      }
      res.writeHead(httpResponse.statusCode, Object.fromEntries(headerList));
      res.end(body);
    } catch (error) {
      // A server that cannot render says why, once.
      console.error("serve: render failed", error);
      if (!res.headersSent) res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
    }
  });

  const port = Number(process.env.PORT ?? "0") || 0;
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("serve: could not bind a port");
  // The contract suite parses this line for the ephemeral port.
  console.log(`seeds-app listening on http://127.0.0.1:${address.port}`);
}

await main();
