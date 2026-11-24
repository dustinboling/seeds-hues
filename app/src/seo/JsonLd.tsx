import { assertNoProhibitedJsonLd } from "../lib/jsonld-guard";
import type { Json } from "./jsonld";

/** Server-rendered JSON-LD. Escapes `<` so data can never close the script element. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  assertNoProhibitedJsonLd(data);
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
