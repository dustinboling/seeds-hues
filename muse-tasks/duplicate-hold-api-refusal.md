# Task: Key-based review API must refuse duplicate_hold decisions (Dustin ruling, 2026-11-21)

Dustin ruled on 2026-11-21: **the key-based admin review API must NOT be able to
decide duplicate holds.** A `duplicate_hold` review item may be decided ONLY
through the admin UI's `decideDuplicate` path. This closes Quinn's Slice A
note M1 (today the generic key-API `approve` on a `duplicate_hold` silently
means "not a duplicate" and creates the variety — an unsafe semantic on a
key-authenticated path).

## What to do

1. Find the generic key-authenticated review decision endpoints (the
   `POST /api/v1/admin/review/...` approve/reject path used with the admin
   API key). When the target review item's type is `duplicate_hold`, refuse
   the decision with an explicit error: a non-2xx status consistent with the
   API's existing error conventions, and a clear error message/code stating
   that duplicate holds are decided in the admin UI only. The item must
   remain pending and unchanged (no variety created, no alias written, no
   status change) on both approve and reject attempts.
2. Change nothing about `decideDuplicate` or the admin UI decision flow —
   it remains the only way to decide a hold, working exactly as today.
3. Change nothing about how the API decides OTHER review types
   (farm submissions, variety proposals, seller corrections, and any other
   queue types must still decide normally through the key API).

## Tests (required, non-vacuous)

- API approve on a `duplicate_hold` item → refusal error; the item is still
  pending afterward and no variety/alias was created.
- API reject on a `duplicate_hold` item → same refusal.
- At least one other queue type still approves AND rejects normally through
  the key API (prove the refusal is type-scoped, not a blanket break).
- The `decideDuplicate` path still decides a hold (existing coverage may
  already prove this; if it does, cite the test by name in your finish
  summary instead of duplicating it).
- State in your finish summary how you proved the new refusal tests fail on
  the old code (e.g. stash/revert check).

## Constraints

- This refusal only. No refactoring of the review service, no changes to
  review-item schemas or migrations, no UI changes.
- US spelling in any text you touch. Follow the repo's standing code
  constraints.

## Finish-line summary (use this as the PR title)

"Duplicate holds: key review API refuses with an explicit error; decideDuplicate (admin UI) is the only decision path"
