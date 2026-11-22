import type { Metadata } from "next";
import { buildOpenApiDocument } from "@/lib/api/openapi";
import { SITE_URL } from "@/lib/config";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Public API (v1)",
  description:
    "JSON API for the seeds.hues.flowers catalogue: crops, varieties, series, sellers, listings, search, coverage, sync and catalog snapshots. OpenAPI 3.1.",
  path: "/api-docs",
});

type Op = { summary?: string; parameters?: { name: string; in: string; required?: boolean; description?: string; schema?: Record<string, unknown> }[] };

function schemaType(s: Record<string, unknown> | undefined): string {
  if (!s) return "";
  if (Array.isArray(s.enum)) return (s.enum as string[]).join(" | ");
  const t = String(s.type ?? "");
  const range =
    s.minimum !== undefined || s.maximum !== undefined ? ` (${s.minimum ?? ""}–${s.maximum ?? ""})` : "";
  return `${t}${range}${s.default !== undefined ? `, default ${String(s.default)}` : ""}`;
}

/** Human-readable docs rendered from the same OpenAPI document served at /api/v1/openapi.json. */
export default function ApiDocsPage() {
  const doc = buildOpenApiDocument(SITE_URL) as {
    info: { description: string; version: string };
    paths: Record<string, { get?: Op; post?: Op }>;
  };
  const base = `${SITE_URL}/api/v1`;
  return (
    <article className="max-w-4xl" aria-labelledby="api-title">
      <h1 id="api-title" className="text-3xl font-semibold text-leaf">
        Public API v1
      </h1>
      <p className="mt-3">{doc.info.description}</p>
      <dl className="card mt-4 grid gap-3 p-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Base URL</dt>
          <dd className="break-all font-mono">{base}</dd>
        </div>
        <div>
          <dt className="text-muted">Contract</dt>
          <dd>
            <a href="/api/v1/openapi.json">OpenAPI 3.1 document (openapi.json)</a>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Methods</dt>
          <dd>GET, HEAD, OPTIONS only — anything else returns 405.</dd>
        </div>
        <div>
          <dt className="text-muted">Rate limit</dt>
          <dd>120 requests per minute per IP; 429 with Retry-After when exceeded.</dd>
        </div>
        <div>
          <dt className="text-muted">Caching</dt>
          <dd>ETag on every GET (send If-None-Match for 304). Catalog version is never cached.</dd>
        </div>
        <div>
          <dt className="text-muted">Pagination</dt>
          <dd>Opaque cursors: pass meta.nextCursor back as ?cursor=. limit 1–100 (default 24).</dd>
        </div>
      </dl>

      <h2 className="mt-8 text-2xl font-semibold">Envelope</h2>
      <pre className="mt-2 overflow-x-auto rounded-inner bg-ink p-4 text-sm text-white">
        <code>{`{ "data": …, "page": { "next_cursor": "…" | null, "has_more": true },
  "meta": { "nextCursor": "…" | null, "count": 24, "total": 68, "catalog_seq": 111, "generated_at": "…" }, "error": null }
{ "data": null, "meta": null, "error": { "code": "not_found", "message": "variety not found" } }
// /sync, /reports: application/problem+json
{ "type": "…", "title": "Gone", "status": 410, "detail": "…", "code": "resync_required" }`}</code>
      </pre>

      <h2 className="mt-8 text-2xl font-semibold">Endpoints</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {Object.entries(doc.paths).map(([path, item]) => {
          const method = item.get ? "GET" : "POST";
          const op = (item.get ?? item.post)!;
          return (
          <li key={path} className="card p-4">
            <h3 className="font-mono text-base font-semibold">
              <span className="mr-2 rounded bg-leaf px-2 py-0.5 text-xs text-white">{method}</span>
              /api/v1{path}
            </h3>
            <p className="mt-1 text-sm">{op.summary}</p>
            {op.parameters?.length ? (
              <table className="mt-3 w-full text-left text-sm">
                <caption className="sr-only">Parameters for {path}</caption>
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                    <th scope="col" className="py-1 pr-3">Parameter</th>
                    <th scope="col" className="py-1 pr-3">In</th>
                    <th scope="col" className="py-1">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {op.parameters.map((p) => (
                    <tr key={p.name} className="border-b border-line last:border-0 align-top">
                      <th scope="row" className="py-1 pr-3 font-mono font-normal">
                        {p.name}
                        {p.required ? <span className="text-petal"> *</span> : null}
                      </th>
                      <td className="py-1 pr-3">{p.in}</td>
                      <td className="py-1">
                        {schemaType(p.schema)}
                        {p.description ? <span className="block text-muted">{p.description}</span> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </li>
          );
        })}
      </ul>

      <h2 className="mt-8 text-2xl font-semibold">Examples</h2>
      <pre className="mt-2 overflow-x-auto rounded-inner bg-ink p-4 text-sm text-white">
        <code>{`curl ${base}/varieties?crop=sweet-pea&limit=5
curl ${base}/varieties/sweet-pea-kings-ransom
curl "${base}/search?q=poppy"
curl ${base}/catalog/version`}</code>
      </pre>
      <p className="mt-4 text-sm text-muted">
        No prices are published. Every listing carries provenance (source_url, retrieved_at, method, confidence);
        every variety and seller carries a rating that reads “not_yet_rated” until real reviews exist.
      </p>
    </article>
  );
}
