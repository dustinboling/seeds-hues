/**
 * Tag taxonomy for on-demand revalidation (spec §4.3 / task 17). Tags map to the page paths
 * that render that data; the route handler revalidates each path (OpenNext writes the path tag
 * to the D1 tag cache) and also expires the tag itself.
 */
import { z } from "zod";
import { smallFarmVariantPath } from "@/lib/small-farm";

const SLUG = "[a-z0-9]+(?:-[a-z0-9]+)*";
export const TAG_PATTERN = new RegExp(`^(?:(?:variety|seller|crop|series):${SLUG}|list:(?:home|variety|seller|crop))$`);

export const RevalidateBodySchema = z
  .strictObject({
    tags: z.array(z.string().regex(TAG_PATTERN, "unknown tag")).max(200).optional(),
    paths: z
      .array(
        z
          .string()
          .max(300)
          .regex(/^\/(?:[a-z0-9._~-]+(?:\/[a-z0-9._~-]+)*)?$/i, "path must be an absolute site path"),
      )
      .max(200)
      .optional(),
  })
  .refine((b) => (b.tags?.length ?? 0) + (b.paths?.length ?? 0) > 0, "provide tags and/or paths");

export type RevalidateBody = z.infer<typeof RevalidateBodySchema>;

/** Paths whose rendered output depends on the given tag. */
export function pathsForTag(tag: string): string[] {
  const [kind, value] = tag.split(":", 2) as [string, string];
  switch (kind) {
    case "variety":
      return [`/variety/${value}`, "/variety", "/sitemap.xml"];
    case "seller":
      return [`/seller/${value}`, "/seller", "/sitemap.xml"];
    case "crop":
      return [`/crop/${value}`, "/crop", "/sitemap.xml"];
    case "series":
      return [`/series/${value}`, "/sitemap.xml"];
    case "list":
      return value === "home" ? ["/"] : [`/${value}`];
    default:
      return [];
  }
}

const VARIETY_PAGE = new RegExp(`^/variety/(${SLUG})$`);

/**
 * Every variety page has a second ISR entry — its "Small farms only" view (Open Directory; public
 * URL /variety/{slug}?small_farm=true, rendered at /variety/{slug}/small-farms). Whatever
 * invalidates /variety/{slug} must invalidate that view too, or the two would disagree for up to
 * 24 h. Every revalidation entry point runs its paths through this (write routes + /api/revalidate).
 */
export function withVariantPaths(paths: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    out.add(p);
    const m = VARIETY_PAGE.exec(p);
    if (m) out.add(smallFarmVariantPath(m[1]!));
  }
  return [...out];
}

/** Constant-time string comparison (bearer token check). */
export function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
