/**
 * The Hues Floral Park wordmark — the owner's master artwork (self-hosted at
 * /brand/hues-logo.svg, never hotlinked). Decorative: the surrounding link
 * carries the accessible name. Intrinsic size is the master's ink bounds.
 */
export function HuesLogo({ className }: { className?: string }) {
  return <img src="/brand/hues-logo.svg" alt="" width={121} height={39} className={className} />;
}
