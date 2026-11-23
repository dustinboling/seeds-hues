# Homepage motif swap — C3 Vine & Pods (Item MOTIF)

## Provenance

- Dustin picked motif option C (Twine & Tag), then revised it to a vine with dried, harvest-ready seed pods; the C2 art was rejected by Dustin on sight (center pod cluster). Elena's C3 revision — six love-in-a-puff pods hanging singly at wide intervals, center third bare vine — passed Quinn's delta design gate (PASS WITH NOTES, no conditions on the art) and was **approved by Dustin 2026-11-22 17:09 PT, verbatim: "Approve C3 — swap it in on the homepage."**
- The C2 swap brief (`motif-c2-homepage-swap.md`) is DEAD — do not build from it. This brief supersedes it.
- The C3 master (2400×365, RGBA) is already staged on main at `v2/public/theme/divider-home.webp`, replacing the inert C2 staging at that path. THEME naming for the build: **C3 — Vine & Pods, Revised (love-in-a-puff)**.

## The change — homepage break only

In `v2/app/page.tsx`, the hero→browse break currently renders `<div className="divider-stem mb-8 mt-10" />` (220×24). Replace that ONE element with the C3 motif image per Mina's PLACEMENT-ADDENDUM-C3 ◆ values:

- `<img>` (or the project's established image pattern for theme assets) with `src` `/theme/divider-home.webp`, `width="2400"`, `height="365"` (aspect-ratio token 2400/365 — the box is reserved by the attributes; no layout shift).
- Rendered: **640×97** at the desktop cap (token `size.divider-home` / `--size-divider-home`, 640px, unchanged), **358×54** at 390px phone width.
- `sizes="(min-width: 672px) 640px, calc(100vw - 32px)"`; `srcset` widths **720w, 1080w, 1440w** via the site's Cloudflare image transformation path (the same mechanism other theme images use — follow the existing pattern in the codebase).
- Margins kept exactly: `mt-10` (40px) above, `mb-8` (32px) below. Total break height: 169px desktop / 126px phone.
- Decorative contract: empty alt, aria-hidden as the codebase's decorative theme images do it; lazy/async loading, no priority/fetchpriority; hidden under forced-colors (the established treatment for decorative theme art).

## Scope fence — everything else stays

Every OTHER stem instance is out of scope and must remain byte-for-byte untouched: FooterStem, prose h2 stems, the listing-card rule, divider minis, placeholders, admin surfaces, OG images. The `.divider-stem` CSS and its other consumers are NOT removed — only the homepage break stops using it. No other homepage change.

## Acceptance

- The homepage break renders the C3 motif at the ◆ sizes; the stem no longer renders at that break; all other stem instances unchanged (a diff of rendered pages before/after shows the break as the only difference).
- No layout shift at the break (intrinsic attributes reserve the box).
- Existing tests updated only where they pin the old break element; full verify green.

## Gate

Quinn build gate with **real-render proof**: the built homepage rendered at desktop + 390px (motif present at 640×97 / 358×54, break heights 169/126, no shift), a stem-instance regression sweep (FooterStem + one listing card + one prose page still render their stems), forced-colors check, and the **1440w AVIF budget proof on real Cloudflare transformed responses** (≤40 KB at 720w, ≤80 KB at 1440w — Quinn's design-stage encodes measured 23.9 KB / 59.1 KB; the build gate proves it on the real transforms). Merge → deploy → live-verify follow the standing pipeline; the dashboard activity log entry under Elena's name (with the shipped file attached) is part of done.

## PR body hygiene

Provenance (this brief + Dustin's approval), the workflow's Build accounting, verify counts (branch + merge-base), and a Gate record section pre-templated for Quinn.
