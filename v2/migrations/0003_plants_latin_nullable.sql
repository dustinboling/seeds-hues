-- Floret Library import (owner-directed 2026-11-16): 74 new crops arrive with a common
-- name only. The data model's explicit-unknowns rule says a fact we do not have stays
-- NULL — a scientific name is never invented — so `plants.latin_name` becomes nullable.
-- Existing rows keep their values; only the NOT NULL constraint is dropped.
-- Rebuild follows the 0002 pattern: PRAGMA defer_foreign_keys (foreign_keys OFF is a
-- no-op inside D1's migration transaction), backup → DROP → CREATE (real name) →
-- re-INSERT → drop backup, with the plants FTS trigger dropped first and recreated
-- unchanged at the end.
PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `plants_fts_au`;
--> statement-breakpoint
CREATE TABLE `__bak_plants` AS SELECT * FROM `plants`;
--> statement-breakpoint
DROP TABLE `plants`;
--> statement-breakpoint
CREATE TABLE `plants` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`common_name` text NOT NULL,
	`latin_name` text,
	`description` text,
	`sowing_notes` text,
	`category_id` integer NOT NULL,
	`updated_seq` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `plants`("id", "slug", "common_name", "latin_name", "description", "sowing_notes", "category_id", "updated_seq", "deleted_at") SELECT "id", "slug", "common_name", "latin_name", "description", "sowing_notes", "category_id", "updated_seq", "deleted_at" FROM `__bak_plants`;
--> statement-breakpoint
DROP TABLE `__bak_plants`;
--> statement-breakpoint
CREATE UNIQUE INDEX `plants_slug_unique` ON `plants` (`slug`);
--> statement-breakpoint
CREATE UNIQUE INDEX `plants_names_uq` ON `plants` (`common_name`,`latin_name`);
--> statement-breakpoint
CREATE INDEX `plants_category_idx` ON `plants` (`category_id`);
--> statement-breakpoint
CREATE INDEX `plants_updated_seq_idx` ON `plants` (`updated_seq`);
--> statement-breakpoint
CREATE TRIGGER `plants_fts_au` AFTER UPDATE OF common_name, latin_name ON `plants` BEGIN
  UPDATE varieties_fts
  SET common_name = NEW.common_name, latin_name = NEW.latin_name
  WHERE rowid IN (SELECT id FROM varieties WHERE plant_id = NEW.id);
END;
