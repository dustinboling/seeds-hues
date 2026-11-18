-- Grower guide (crop-page grower guide task): life cycle + hardiness for the crop header fact,
-- and the guide content (growing, harvest for cutting, seed saving) as one JSON text value,
-- with the internal source it came from (never displayed). Additive only: existing rows keep
-- NULL (= no content, explicit unknown).
ALTER TABLE `plants` ADD COLUMN `life_cycle` text;
--> statement-breakpoint
ALTER TABLE `plants` ADD COLUMN `hardiness` text;
--> statement-breakpoint
ALTER TABLE `plants` ADD COLUMN `grower_guide` text;
--> statement-breakpoint
ALTER TABLE `plants` ADD COLUMN `grower_guide_source_id` integer REFERENCES `sources`(`id`);
