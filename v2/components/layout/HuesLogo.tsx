/**
 * The Hues Floral Park wordmark — the owner's master artwork (solid single-colour, deep green
 * #2E4438), self-hosted at /brand/hues-logo.svg and never hotlinked. The wordmark is the Hues
 * script itself, so the image is decorative: the surrounding link carries the accessible name
 * ("Hues Floral Park"). Intrinsic size is the master's true ink bounds (121 × 39.1).
 */
export function HuesLogo({ className }: { className?: string }) {
  /* A plain <img>: the file is a fixed local asset, so next/image adds nothing here. */
  /* eslint-disable-next-line @next/next/no-img-element */
  return <img src="/brand/hues-logo.svg" alt="" width={121} height={39} className={className} />;
}
