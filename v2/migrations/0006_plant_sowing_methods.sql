-- Sowing methods (seeds-v2 brief #2): a crop can be direct sown, started in plug trays and
-- transplanted, or both — from the Floret Library sowing notes. One row per (crop, method),
-- modelled on variety_tags; a crop with no rows is not classified (explicit unknown).
-- plants.sowing_method_source_id records the source the methods came from, mirroring
-- season_source_id. Additive only: existing plants keep NULL and have no method rows.
CREATE TABLE `plant_sowing_methods` (
	`plant_id` integer NOT NULL,
	`method` text NOT NULL,
	PRIMARY KEY(`plant_id`, `method`),
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "plant_sowing_methods_method_chk" CHECK(method IN ('direct_sow', 'transplant'))
);
--> statement-breakpoint
CREATE INDEX `plant_sowing_methods_method_idx` ON `plant_sowing_methods` (`method`);
--> statement-breakpoint
ALTER TABLE `plants` ADD COLUMN `sowing_method_source_id` integer REFERENCES `sources`(`id`);
