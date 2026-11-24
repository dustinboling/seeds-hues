import type { HeadTags } from "./meta";

/**
 * One page's head tags (description, canonical, robots, Open Graph, Twitter
 * card). Rendered by each route's +Head; JSON-LD rides in the page body like
 * v2. <title> and og:title come from the route's `title` setting (vike-react
 * renders both, and keeps <title> in sync on client navigations) — this
 * component must not render either. The client router never rewrites the
 * canonical. Known platform delta, recorded: og:title carries the same
 * template-suffixed string as <title> (v2's og:title omits the suffix).
 */
export function SeoHead({ tags }: { tags: HeadTags }) {
  return (
    <>
      <meta name="description" content={tags.description} />
      <link rel="canonical" href={tags.canonical} />
      <meta name="robots" content={tags.robots} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="seeds.hues.flowers" />
      <meta property="og:url" content={tags.og.url} />
      <meta property="og:description" content={tags.og.description} />
      <meta property="og:image" content={tags.og.url} />
      <meta property="og:image:width" content={String(tags.og.width)} />
      <meta property="og:image:height" content={String(tags.og.height)} />
      <meta property="og:image:alt" content={tags.og.alt} />
      {tags.og.type ? <meta property="og:image:type" content={tags.og.type} /> : null}
      <meta property="og:locale" content="en_US" />
      <meta name="twitter:card" content={tags.twitter.card} />
      <meta name="twitter:title" content={tags.twitter.title} />
      <meta name="twitter:description" content={tags.twitter.description} />
      <meta name="twitter:image" content={tags.twitter.image} />
    </>
  );
}
