/**
 * Tranche 1.8's OG card model address. The implementation lives in lib/seo/og-card.ts —
 * main extracted this same module in parallel, and the successor merge keeps that one
 * implementation — so this module re-exports 1.8's entry points unchanged.
 */
export { buildOgCard, type OgCard } from "./seo/og-card";
