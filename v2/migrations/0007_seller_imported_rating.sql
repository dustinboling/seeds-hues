-- Imported seller ratings (seeds-v2 brief #4): a third-party aggregate (Google Places: rating +
-- review count only, no review text) stored per seller with its place and fetch date. All six
-- columns are set together or all NULL (enforced by the catalog schema). These are NOT our
-- rating: rating_count / rating_average stay untouched and the site keeps "Not yet rated".
-- Additive only: existing sellers keep NULL. SQLite cannot add a table-level CHECK with ALTER
-- TABLE, so the sellers_imported_rating_*_chk rules from lib/db/schema.ts are attached as
-- column constraints (same predicates).
ALTER TABLE `sellers` ADD COLUMN `imported_rating_source` text CONSTRAINT `sellers_imported_rating_source_chk` CHECK (imported_rating_source IS NULL OR imported_rating_source IN ('Google'));
--> statement-breakpoint
ALTER TABLE `sellers` ADD COLUMN `imported_rating_place_name` text;
--> statement-breakpoint
ALTER TABLE `sellers` ADD COLUMN `imported_rating_place_id` text;
--> statement-breakpoint
ALTER TABLE `sellers` ADD COLUMN `imported_rating_value` real CONSTRAINT `sellers_imported_rating_value_chk` CHECK (imported_rating_value IS NULL OR (imported_rating_value >= 0 AND imported_rating_value <= 5));
--> statement-breakpoint
ALTER TABLE `sellers` ADD COLUMN `imported_rating_count` integer CONSTRAINT `sellers_imported_rating_count_chk` CHECK (imported_rating_count IS NULL OR imported_rating_count >= 0);
--> statement-breakpoint
ALTER TABLE `sellers` ADD COLUMN `imported_rating_fetched_at` text;
