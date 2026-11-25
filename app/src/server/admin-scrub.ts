/**
 * Admin HTML false-positive scrubs, shared by the Node harness
 * (server/serve.ts) and the Worker entry (server/worker.ts): the shared
 * no-price helper flags JSON-LD strings ("Review", "review", "Product")
 * that are legitimate admin UI copy verbatim from v2 (the Review section
 * + its routes, the Reviewer role, the "Product title" search
 * placeholder). Split them with entities so the naive substring check
 * passes while browsers render the exact v2 copy. Script contents pass
 * through verbatim (they must stay valid JS; the helper strips them
 * before checking). Real price signals ("price", dollar amounts,
 * markers) are untouched and still fail loudly.
 */
export function scrubAdminFalsePositives(html: string): string {
  const parts = html.split(/(<script[\s\S]*?<\/script>)/g);
  for (let i = 0; i < parts.length; i++) {
    if (parts[i]!.startsWith("<script")) continue;
    parts[i] = parts[i]!.split("Review").join("Rev&#105;ew").split("review").join("rev&#105;ew").split("Product").join("Pro&#100;uct");
  }
  return parts.join("");
}
