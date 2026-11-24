# Variety-level Latin override + Chantilly series assignment (small data-mechanism build)

## Provenance — READ BEFORE writing code

Latin names in this catalog live at PLANT level (`plants.latin_name`), shared by every variety of the plant. Four verified variety-level corrections cannot be expressed that way (verified by coordinator #21, 2026-11-23, against the sellers' own pages):

1. **Nigella 'Transformer' (variety 262)** is *Nigella orientalis* (Fedco's own product page names it so and contrasts it with its damascena nigellas; Seedaholic + the breeder data sheet agree). The plant's *N. damascena* is correct for the other 8 nigella varieties sharing plant 5 — a plant-level edit would corrupt them.
2. **Cress 'Green Dragon' (variety 181)** is *Lepidium ruderale* (The Gardener's Workshop's own product page — the surviving seller). The Cress plant's Latin is NULL and **correctly** NULL: the crop's varieties are mixed-species. The correction must live at variety level only.
3. **Milkweed 'Oscar' (variety 714)** is *Asclepias physocarpa* (referred from the painting lane; the plant-level value names a different species for this variety).
4. **Spike Speedwell 'Blauteppich'** is *Veronica spicata* (same referral class; resolve the variety's id/slug from the catalog at apply time).

Separately, the **Chantilly snapdragon** varieties carry Series: "None" in the catalog although Chantilly is Takii's named series — so `/search` renders no Series group for them (observed live 2026-11-23). The records need the series assigned through the catalog's existing series model.

Authorization for the schema change: Dustin's standing additive-schema authorization (2026-11-22 — small additive changes proceed without gating on him).

## The build

1. **Additive column:** `latin_name` (nullable text) on `varieties`, via the next migration in sequence. No other schema change; nothing renamed, dropped, or retyped.
2. **Read preference:** everywhere a variety's Latin name is read for display (variety page facts, shop product cards, any other consumer of the plant's Latin for a variety — census them all), the variety's own `latin_name` wins when set; the plant's value is the fallback; neither set → no Latin line (never a placeholder). One read path, not per-surface forks.
3. **Admin write path:** extend the existing admin varieties endpoint family (`/api/v1/admin/varieties/:id…`, admin-scope key, the family that already carries the remove endpoint) with a way to set/clear a variety's `latin_name`, following that family's established patterns (auth, problem responses, idempotence where the family has it, revalidation of the variety page + sitemap where the family does it). Setting `null`/empty clears the override back to the plant fallback.
4. **Chantilly series assignment:** investigate the catalog's existing series model (how series are stored, related, and read by `/search`'s grouping). Assign Takii's Chantilly series to exactly the Chantilly snapdragon variety records through the model's existing write path if one exists; if none exists, add the minimal admin write path in the same endpoint family (same patterns as §3). Scope fence: ONLY the Chantilly snapdragon records change; no other variety's series value is touched; if the series entity itself must be created, create exactly one (name: Chantilly) and say so.
5. **Tests:** read-preference (variety wins / plant fallback / neither → absent) at the level the codebase tests catalog reads; endpoint tests in the admin family's existing test style (set, clear, unknown variety, unauthorized); a series-assignment test proving the Chantilly records carry the series and a non-Chantilly snapdragon does not. T-A: every new test fails on pre-build code, passes on yours — demonstrate and report both directions.

## Data application (NOT part of the PR)

The four Latin values and the Chantilly assignment are applied to production data by the coordinator after this build ships (through the new write paths, with read-back verification). Do not seed, migrate-data, or hard-code the four values anywhere in code or migrations. (The Chantilly assignment mechanism is in the PR; whether the assignment itself is code or coordinator-applied data follows from what the existing model supports — state your recommendation in the PR body.)

## PR body (full accounting, not the workflow stub)

Provenance (this brief + the four verified corrections with their sources); the consumer census for Latin display (every surface the preference reaches); the endpoint's exact shape and how it follows the family; the series-model findings (storage, relation, the write path used or added, the exact record scope); T-C (no public payload field added — the Latin value already renders publicly today where the plant carries it; state this explicitly); T-A both directions; migration number and its additive-only statement.

## Boundaries

- Plant-level Latin values are NOT changed anywhere (plant 5 keeps *N. damascena*; the Cress plant keeps NULL).
- No variety names, slugs, or URLs change. No prices anywhere. No other data changes.
- Migration is additive only. Quinn gates (mechanism + read-preference + endpoint + the series scope fence). Do not merge, deploy, or touch production data.
