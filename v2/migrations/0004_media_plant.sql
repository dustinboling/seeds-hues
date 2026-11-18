-- Plant media (seeds-v2-plant-media, design D1): one illustration per crop. Same storage
-- convention as variety media: `media.r2_key` holds the public path
-- (`/artwork/crops/<plant-slug>.webp`). Additive only; existing media rows keep plant_id NULL.
ALTER TABLE `media` ADD COLUMN `plant_id` integer REFERENCES `plants`(`id`);
--> statement-breakpoint
CREATE INDEX `media_plant_idx` ON `media` (`plant_id`);
