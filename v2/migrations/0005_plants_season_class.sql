-- Season classes (seeds-v2-season): a crop is a Cool Season Hardy Annual or a Warm Season
-- Tender Annual, modelled on The Gardener's Workshop's seed categories, with the source the
-- class came from. Additive only: existing rows keep NULL (= not classified, explicit unknown).
-- SQLite cannot add a table-level CHECK with ALTER TABLE, so the plants_season_class_chk rule
-- from lib/db/schema.ts is attached as a column constraint (same predicate).
ALTER TABLE `plants` ADD COLUMN `season_class` text CONSTRAINT `plants_season_class_chk` CHECK (season_class IS NULL OR season_class IN ('cool_season_hardy_annual', 'warm_season_tender_annual'));
--> statement-breakpoint
ALTER TABLE `plants` ADD COLUMN `season_source_id` integer REFERENCES `sources`(`id`);
