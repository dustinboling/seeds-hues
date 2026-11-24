import { useData } from "vike-react/useData";
import { SITE_URL } from "../../src/site";
import type { Data } from "./+data";

/** Human-readable parameter type — ported from v2/app/api-docs/page.tsx. */
function schemaType(s: Record<string, unknown> | undefined): string {
  if (!s) return "";
  if (Array.isArray(s.enum)) return (s.enum as string[]).join(" | ");
  const t = String(s.type ?? "");
  const range =
    s.minimum !== undefined || s.maximum !== undefined ? ` (${s.minimum ?? ""}–${s.maximum ?? ""})` : "";
  return `${t}${range}${s.default !== undefined ? `, default ${String(s.default)}` : ""}`;
}

/**
 * /api-docs — human-readable docs rendered from the same OpenAPI document
 * served at /api/v1/openapi.json. Structure and standing copy ported verbatim
 * from v2/app/api-docs/page.tsx; the endpoint inventory comes from the live
 * document through the data layer instead of v2's local builder.
 */
export default function Page() {
  const { doc } = useData<Data>();
  const base = `${SITE_URL}/api/v1`;
  return (
    <article className="api-docs" aria-labelledby="api-title">
      <h1 id="api-title">Public API v1</h1>
      <p className="api-docs-intro">{doc.info.description}</p>
      <dl className="card api-docs-facts">
        <div>
          <dt>Base URL</dt>
          <dd className="mono">{base}</dd>
        </div>
        <div>
          <dt>Contract</dt>
          <dd>
            <a href="/api/v1/openapi.json">OpenAPI 3.1 document (openapi.json)</a>
          </dd>
        </div>
        <div>
          <dt>Methods</dt>
          <dd>GET, HEAD, OPTIONS only — anything else returns 405.</dd>
        </div>
        <div>
          <dt>Rate limit</dt>
          <dd>120 requests per minute per IP; 429 with Retry-After when exceeded.</dd>
        </div>
        <div>
          <dt>Caching</dt>
          <dd>ETag on every GET (send If-None-Match for 304). Catalog version is never cached.</dd>
        </div>
        <div>
          <dt>Pagination</dt>
          <dd>Opaque cursors: pass meta.nextCursor back as ?cursor=. limit 1–100 (default 24).</dd>
        </div>
      </dl>

      <h2>Envelope</h2>
      <pre>
        <code>{`{ "data": …, "page": { "next_cursor": "…" | null, "has_more": true },
  "meta": { "nextCursor": "…" | null, "count": 24, "total": 68, "catalog_seq": 111, "generated_at": "…" }, "error": null }
{ "data": null, "meta": null, "error": { "code": "not_found", "message": "variety not found" } }
// /sync, /reports: application/problem+json
{ "type": "…", "title": "Gone", "status": 410, "detail": "…", "code": "resync_required" }`}</code>
      </pre>

      <h2>Endpoints</h2>
      <ul className="endpoint-list">
        {Object.entries(doc.paths).map(([path, item]) => {
          const method = item.get ? "GET" : "POST";
          const op = (item.get ?? item.post)!;
          return (
            <li key={path} className="card">
              <h3>
                <span className="endpoint-method">{method}</span>
                /api/v1{path}
              </h3>
              <p className="endpoint-summary">{op.summary}</p>
              {op.parameters?.length ? (
                <table className="param-table">
                  <caption className="sr-only">Parameters for {path}</caption>
                  <thead>
                    <tr>
                      <th scope="col">Parameter</th>
                      <th scope="col">In</th>
                      <th scope="col">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {op.parameters.map((p) => (
                      <tr key={p.name}>
                        <th scope="row">
                          {p.name}
                          {p.required ? <span className="param-required"> *</span> : null}
                        </th>
                        <td>{p.in}</td>
                        <td>
                          {schemaType(p.schema)}
                          {p.description ? <span className="param-desc">{p.description}</span> : null}
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

      <h2>Examples</h2>
      <pre>
        <code>{`curl ${base}/varieties?crop=sweet-pea&limit=5
curl ${base}/varieties/sweet-pea-kings-ransom
curl "${base}/search?q=poppy"
curl ${base}/catalog/version`}</code>
      </pre>
      <p className="api-docs-note">
        No prices are published. Every listing carries provenance (source_url, retrieved_at, method, confidence);
        every variety and seller carries a rating that reads “not_yet_rated” until real reviews exist.
      </p>
    </article>
  );
}
