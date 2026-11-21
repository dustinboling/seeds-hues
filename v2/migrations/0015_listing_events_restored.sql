-- Slice C (listings): E2's Restore writes a 'restored' event, and history lines name who
-- acted. listing_events carries a CHECK on its event enum, so the new value needs a rebuild:
-- create the new table (old columns + the actor column + the extended check), copy every row
-- with an explicit column list (ids and all values preserved verbatim; actor takes NULL),
-- drop, rename, recreate the two indexes. listing_events is a leaf log (nothing references
-- it), so the rename pattern is safe here. This is Slice C's ONLY schema change.
PRAGMA defer_foreign_keys = on;
--> statement-breakpoint
CREATE TABLE `listing_events_new` (
	`id` integer PRIMARY KEY NOT NULL,
	`listing_id` integer NOT NULL,
	`event` text NOT NULL,
	`at` text NOT NULL,
	`reason` text,
	`actor` text,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "listing_events_event_chk" CHECK(event IN ('first_seen', 'restocked', 'sold_out', 'gone', 'restored'))
);
--> statement-breakpoint
INSERT INTO `listing_events_new` (`id`, `listing_id`, `event`, `at`, `reason`) SELECT `id`, `listing_id`, `event`, `at`, `reason` FROM `listing_events`;
--> statement-breakpoint
DROP TABLE `listing_events`;
--> statement-breakpoint
ALTER TABLE `listing_events_new` RENAME TO `listing_events`;
--> statement-breakpoint
CREATE INDEX `listing_events_listing_idx` ON `listing_events` (`listing_id`);
--> statement-breakpoint
CREATE INDEX `listing_events_at_idx` ON `listing_events` (`at`);
