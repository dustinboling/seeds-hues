# Task: Tranche 1.4 — friendly dates everywhere + one zero-seller sentence (full audit 2026-11-21, §6 item 1.4; joint recommendation Batch 0.1 + 0.2)

Two copy-consistency defects from the full audit, plus one standing-rule
deletion in the same copy family. Wren's audit sections are the evidence:
`full-audit-2026-11-21/sections/wren-copy.md` M2 + M3 and
`sections/nadia-ux.md` UX-07.

## What to do

### 1. Friendly dates everywhere (Batch 0.1)

No raw ISO date (`YYYY-MM-DD`) may reach reader prose anywhere on the public
site. The known residue (audit UX-07, verified live at audit time):

- The variety answer line opens "As of 2026-11-20, …".
- The home hero line ends "· updated 2026-11-21".
- The crop header reads "· last updated 2026-11-20".
- The home Recent list slices ISO in code (`app/page.tsx`: `r.at.slice(0, 10)`).

Route every one through the site's existing friendly date formatting
(`lib/format.ts` — the family that already produces the listing rows'
"Checked Nov 19" / "Checked yesterday"). Keep each line's wording and
meaning; only the date's rendering changes (e.g. "As of Nov 20, 2026, …").
Sweep the public app for any other ISO date reaching prose (page bodies,
answer lines, meta descriptions, OG cards, llms.txt) and convert those too;
name any you find in your finish summary. Dates inside admin keep their
existing America/Los_Angeles rendering — do not touch admin.

### 2. One zero-seller sentence (Batch 0.2)

The fact "no seller lists this variety" is currently worded at least seven
ways (audit M3, with file:line for each). Adopt the answer sentence as the
one canonical form — **"No seller found selling {name} yet."** — declared
once in a shared constant module (the way `lib/small-farm.ts` centralizes
the Small Farm strings), and derive every surface from it:

- `lib/services/catalog.ts` (the answer sentence — already canonical; source
  it from the shared constant).
- `lib/services/template.ts` (template description sentence + the
  meta-description fragment). The same fragment says "Available from {n}
  supplier(s)" — "supplier" appears nowhere else in reader copy; make it
  "seller(s)" while you are in these exact lines.
- `app/variety/[slug]/variety-view.tsx` (the body paragraph currently stacks
  two variants: "No sellers yet — currently unavailable. No seller in this
  directory is selling this variety right now." — replace with the canonical
  form).
- `lib/seo/metadata.ts` (meta title "No Seller Listing Yet" → derive from
  the canonical form).
- `app/og/[kind]/[slug]/route.tsx` (OG card line → canonical form).
- `app/crop/[slug]/page.tsx` (crop empty state → canonical form with the
  crop's name; keep its waitlist pointer sentence after it).
- `components/variety/VarietyCard.tsx` — "No sellers yet" stays as the card
  short form, but declare it in the same shared module as the labeled short
  form of the canonical sentence.
- `app/seller/[slug]/page.tsx` — "No listings for this seller yet." is a
  different fact (a seller with no listings); keep the sentence, but declare
  it in the same shared module as the seller-surface form so the family
  lives in one place.

Do not change any other copy. Terminology beyond the lines above (the wider
seller/shop wording question) is out of scope.

### 3. Delete the future-sales hint on /about/data (audit M2)

`app/about/data/page.tsx` ("Who runs this site") contains the sentence
"If Hues ever lists its own seed, its seller page says so." Standing rule:
public copy says the directory does not sell seed and NEVER hints that Hues
will sell seed in the future. Delete that sentence. The disclosure it sat
beside is already carried by the locked conflict-of-interest line in the
same paragraph (`lib/config.ts` CONFLICT_OF_INTEREST) — do not alter that
line or anything around it.

## Tests (required, non-vacuous)

- Rendered-output assertions that the home hero line, a variety answer line,
  a crop header, and the home Recent list contain NO ISO date pattern
  (`/\d{4}-\d{2}-\d{2}/`) and DO contain the friendly form.
- A zero-seller variety fixture: page body, meta title/description, and OG
  payload all carry the canonical sentence from the shared constant; a test
  that fails if any of the old variants ("No seller in this directory lists
  it yet", "No Seller Listing Yet", "currently unavailable" wording) returns.
- The /about/data page no longer contains "If Hues ever lists its own seed"
  (and the conflict-of-interest line is byte-unchanged).
- State in your finish summary how you proved the new tests fail on the old
  code (stash/revert check).

## Constraints

- Copy changes only, in the surfaces named. No layout, styling, or behavior
  changes; no other wording edits, however tempting.
- US spelling in any text you touch. Follow the repo's standing code
  constraints (strict TypeScript, existing patterns).

## Finish-line summary (use this as the PR title)

"Tranche 1.4: friendly dates everywhere, one canonical zero-seller sentence, future-sales hint deleted from /about/data"
