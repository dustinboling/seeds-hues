# Slice 1 — App skeleton + design-system wiring (Seed Directory SPA conversion)

You are building Slice 1 of 9 in the Seed Directory's conversion from Next.js to a Vike + React SPA. Read these repo files first — they govern this slice: `spa-conversion-2026-11-23/ARCHITECTURE-BRIEF.md`, `spa-conversion-2026-11-23/DESIGN-SYSTEM-DEPENDENCY.md`, `spa-conversion-2026-11-23/BUILD-SEQUENCE.md` (Slice 1 row), and `spa-conversion-2026-11-23/OPEN-QUESTIONS.md` (Dustin's Q1–Q4 rulings). Consult the CURRENT official Vike and Vite documentation for scaffold conventions before writing config — do not work from memory of older versions.

## Standing constraints

- Everything in this slice is INERT: the live site is `v2/` (Next.js), deployed from `v2/`; nothing in `app/` is deployed, routed, or referenced by `v2/` until Slice 9. Do not change deploy configuration (`v2/wrangler.jsonc`, deploy scripts) at all.
- The only permitted change inside `v2/` is the verify-chain extension in §6 (its `package.json` scripts + lockfile if needed). No other `v2/` file changes.
- Do NOT edit `.github/workflows/*` — if you conclude a workflow change is required, stop that part, say so plainly in your summary, and finish the rest. (Workflow changes route through a separate gated path.)
- Production standard: strict TypeScript, rigorous error handling, no placeholder stubs — except the tab-bar placeholder in §4, which is named and deliberate.
- WCAG 2.2 AA applies to the shell you build.

## 1. Scaffold `app/`

Create the application tree at repo-root `app/`: Vike (on Vite) + React + TypeScript, per the architecture brief's rendering model (per-route config; nothing user-facing renders yet beyond the shell proof page in §4). Include: `package.json` with scripts (`dev`, `build`, `lint`, `typecheck`, `test`, `verify` = lint + typecheck + test), ESLint + TS config at the repo's existing strictness, Vitest wired for the app tree, and a README in `app/` stating the tree's purpose, the inert-until-Slice-9 rule, and how to run its verify.

## 2. Design-system consumption (@hues/tokens, @hues/fonts)

Probe first, in this order:
1. Try consuming `@hues/tokens@1.0.0` and `@hues/fonts@1.0.0` from GitHub Packages (registry `https://npm.pkg.github.com`, scope `@hues`; the run's `GITHUB_TOKEN` authenticates). If both install cleanly, consume them from the registry and say so.
2. If either is not published or not reachable, do NOT vendor copies of the packages and do NOT fork them. Instead: create `app/src/design-system/` as the single mirror point — token files that implement the @hues layer structure (ref → sys → theme.seeds → comp) for the seeds values in §3, and a fonts module implementing the @hues/fonts loading mechanics for the faces in §5. Put a `SWAP.md` in that directory naming the exact files/imports that change when the registry packages land, and state the fallback plainly in your summary. Quinn's gate will verify the mirror against the package sources.

## 3. Token mapping pass (the slice's centre of gravity)

Map seeds' live token system (source of truth: `v2/app/globals.css` `@theme` block + `THEME-REPORT.md` — paper, paper-deep, surface, ink, ink-soft, muted, line/line-strong, leaf, leaf-600, leaf-50, link, petal, warn, sage, focus) into the @hues layers. Dustin's rulings that bind this slice:

- **Q3 — warmed ground:** the app ground takes the design system's seeds value `seeds-ground` = `#f8f6ec` (replacing live paper `#f8f1e1` as `sys.color.bg`; PWA theme-color follows it). This is the conversion's ONLY deliberate color delta — every other value ports as-is.
- The seeds sys mappings from the design system's `theme.seeds.json`: `sys.color.bg = seeds-ground #f8f6ec`, `sys.color.link = seeds-link #1B5E37`, `sys.color.accent = fern #2D6A4F`, `sys.color.accent-strong = seeds-deep #1B4332`, `sys.color.text-muted = seeds-muted #595959`, `sys.color.accent-ink = gold-ink #86691f`, `sys.color.border-field = ink-soft #71806c`.

Deliver the mapping as data + a test: a machine-readable mapping table (every seeds token name → its @hues layer/name/value) AND an automated test that fails if any seeds token name is unmapped or any mapped value differs from the source — a silent token miss renders as an unstyled surface, and this test is what catches it. Iris + Ada re-verify the affected contrast pairs (ground change) at Quinn's gate, so include a contrast table for every text/background pair the ground delta touches, computed from the actual values.

## 4. Shell

App shell with header, footer, and a tab-bar PLACEHOLDER (structure + slots only — the gated D1 tab-bar design is post-cutover work; do not design a tab bar here), plus the shared mechanics seeds takes from @hues/ui per the dependency doc: focus management on route change and a route-announcement live region (or faithful app-local equivalents under §2's fallback, named in SWAP.md). One proof route (`/` rendering the shell with a plain "conversion in progress" internal marker is NOT acceptable as public copy — render the shell with the directory's name and no marketing copy; this route is never deployed in this slice).

## 5. Fonts

UI/tool layer sans = **Source Sans 3** (Dustin's Q2 ruling) loaded with @hues/fonts mechanics (self-hosted woff2, preload discipline, licenses recorded). Editorial faces stay: Fraunces (display) + Newsreader (prose) — reuse the woff2 assets already in this repo (under `v2/`) where they exist. No external font CDN links (no hotlinking of any kind).

## 6. Verify extension + no-price JSON-LD guard

The bench gate runs `npm run verify` in `v2/`. Extend `v2/package.json`'s `verify` script so it ALSO runs the app tree's verify (lint + typecheck + tests) after v2's own — the gate must go red if `app/` breaks, and Quinn will prove that with a deliberately broken app file. Port the **no-price JSON-LD guard** into the app tree as a tested utility (`assertNoProhibitedJsonLd` or equivalent) enforcing Bea's prohibited list for structured data: `Product`, `Offer`, `AggregateOffer`, `AggregateRating`, `Review`, and any `price` key anywhere in a JSON-LD payload — with tests covering each prohibited case and a clean-payload pass. (The guard is exercised on real payloads from Slice 2 on; here the utility + its tests land.)

## 7. PWA skeleton

Web app manifest (name, icons referencing the existing Three Seeds & a Sprout icon set, `theme_color` = the warmed ground) + a Workbox `injectManifest` service-worker skeleton that builds and registers, with an automated proof (test or build-output assertion) that the SW is emitted and the registration code is in the shell. Offline behaviour and caching strategies are later slices — skeleton only, but real: it must register.

## Your summary must state

- Which §2 path was taken (registry vs mirror) with the probe evidence.
- The token mapping outcome (counts mapped, any name that had no home and what you did).
- How the gate's verify now covers `app/` (the exact script chain).
- Anything you stopped on (esp. any workflow change you believe is needed).
