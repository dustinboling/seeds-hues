-- Slice A (review queues): the decider trail on review_items, the duplicate_hold queue
-- type, alias provenance on variety_aliases, and a decision-note column on farm_submissions.
--
-- review_items carries a CHECK on its type enum, so the new type needs a rebuild: create the
-- new table (old columns + new columns + the extended check), copy every row with an
-- explicit column list (ids and all values preserved), drop, rename, recreate the two
-- indexes. review_items has no FKs in either direction, so the rename pattern is safe here.
-- Everything else is an additive ALTER; existing rows take NULL (legacy/manual).
PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
CREATE TABLE `review_items_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`group_key` text NOT NULL,
	`proposal` text NOT NULL,
	`reason` text,
	`confidence` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text,
	`decided_by_user_id` integer,
	`decided_by_name` text,
	`verified_by_name` text,
	`verified_at` text,
	`seen_by_name` text,
	`seen_at` text,
	CONSTRAINT "review_items_type_chk" CHECK(type IN ('listing_match', 'new_variety', 'seller_candidate', 'seller_correction', 'removal', 'duplicate_hold')),
	CONSTRAINT "review_items_status_chk" CHECK(status IN ('pending', 'approved', 'rejected', 'merged'))
);
--> statement-breakpoint
INSERT INTO `review_items_new` (`id`, `type`, `group_key`, `proposal`, `reason`, `confidence`, `status`, `created_at`, `resolved_at`) SELECT `id`, `type`, `group_key`, `proposal`, `reason`, `confidence`, `status`, `created_at`, `resolved_at` FROM `review_items`;
--> statement-breakpoint
DROP TABLE `review_items`;
--> statement-breakpoint
ALTER TABLE `review_items_new` RENAME TO `review_items`;
--> statement-breakpoint
CREATE INDEX `review_items_status_type_idx` ON `review_items` (`status`,`type`);
--> statement-breakpoint
CREATE INDEX `review_items_group_idx` ON `review_items` (`group_key`);
--> statement-breakpoint
-- Alias provenance: only duplicate decisions write source = 'duplicate_decision'. Existing
-- rows stay NULL (= legacy/manual). F2 (Slice C) renders decision-created aliases
-- non-removable from these columns (RA-1).
ALTER TABLE `variety_aliases` ADD COLUMN `source` text;
--> statement-breakpoint
ALTER TABLE `variety_aliases` ADD COLUMN `decision_item_id` integer;
--> statement-breakpoint
ALTER TABLE `variety_aliases` ADD COLUMN `decided_by_name` text;
--> statement-breakpoint
ALTER TABLE `variety_aliases` ADD COLUMN `created_at` text;
--> statement-breakpoint
-- Farm-submission decline reasons (the C2 sheet's optional reason is kept on the record;
-- review_items has `reason`, farm_submissions had no equivalent column).
ALTER TABLE `farm_submissions` ADD COLUMN `decision_note` text;
