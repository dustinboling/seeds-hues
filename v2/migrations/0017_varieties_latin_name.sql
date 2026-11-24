-- Variety-level Latin override (coordinator brief 2026-11-23): four verified corrections
-- each name a species for ONE variety that differs from what its plant row carries (so a
-- plant-level edit would corrupt the variety's siblings — e.g. plant 5 keeps its Latin for
-- its other eight nigella varieties, and the Cress plant stays NULL). The override lives
-- on the variety row; reads prefer it with the plant's value as the fallback (coalesce at
-- the read sites). Additive only: one nullable column, no backfill, no existing table
-- rebuilt, no other change.
ALTER TABLE `varieties` ADD COLUMN `latin_name` text;
