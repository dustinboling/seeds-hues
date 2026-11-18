import { assertNoProhibitedJsonLd } from "@/lib/seo/jsonld";

/** Server-rendered JSON-LD. Escapes `<` so data can never close the script element. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  assertNoProhibitedJsonLd(data);
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}
