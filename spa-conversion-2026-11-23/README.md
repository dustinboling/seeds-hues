# Seed Directory SPA Conversion — Phase 1 Prep Package

**Commissioned:** Dustin, voice call 2026-11-23 ~21:56 PT ("Can you get going on the seeds website conversion?") — conversion starts now, in parallel with hues.flowers, superseding the hues-first queue order.
**Scope additions:** all other Seeds build/feature work FROZEN under Dustin's stop order (~21:58 PT) — CSN halted mid-build (run cancelled pre-WIP-push; brief intact on main, migration 0019 never applied — resume is a fresh dispatch), SI / TAB / seller-tags / wishlist paused; they resume on the new stack after cutover. **Admin is IN scope** (Dustin, ~22:00 PT).
**Target:** Vike (on Vite) + React + TypeScript; prerendered static set, request-time SSR + edge cache for slug routes, SPA surfaces for account/admin. Backend (D1, /api/v1, ingest, admin auth, image pipeline) unchanged. Public URLs unchanged.

## Contents

| File | What it is |
| --- | --- |
| ROUTE-INVENTORY.md | Every route template: rendering class, indexability, production counts (818 varieties / 83 shops / 124 crops / 33 series / 31 states) — incl. every /admin surface |
| PRERENDER-CONTENT-AUDIT.md | Bea Discovery's per-template complete-content contract, Quinn's raw-HTML JS-disabled gate checks, 404/301 rules, sitemap parity, Search Console baseline status |
| ARCHITECTURE-BRIEF.md | How seeds maps onto the Phase-1 plan: carry-overs, Vike structure per route class, PWA story, admin, cutover shape |
| DESIGN-SYSTEM-DEPENDENCY.md | What seeds takes from @hues/tokens·fonts·ui vs what stays seeds' own (Catalogue theme, gouache system); 4 named conflicts |
| ENVIRONMENT-STANDARD.md | seeds-hues workflow vs the program standard (E1–E4 gaps); prep only — no workflow change while the pipeline is frozen |
| BUILD-SEQUENCE.md | Slices 0–9, each independently dispatchable/gateable/mergeable; cutover last; post-cutover order for wishlist → CSN → SI → TAB → seller tags |
| OPEN-QUESTIONS.md | Q1 admin session rule · Q2 UI sans · Q3 warmed ground · Q4 cutover stagger — each with the team's recommendation; carried dependencies |

## Dashboard

A dashboard card for the conversion programme is needed on the Seed Directory project — the Project Operations instance owns card pushes; the facts are recorded here and in PROGRAM.md for it to mirror.
