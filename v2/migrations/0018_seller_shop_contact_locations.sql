-- Seller-as-shop (2026-11-22): the seller contact block's published channels plus the
-- multi-location store (SPEC-LOCATIONS F-L1). Additive only: two nullable columns on
-- sellers, one new child table + FK index. Nothing renamed, dropped, or retyped. No
-- backfill, no data migration — sellers without a published channel stay NULL (absence,
-- never a placeholder), and the coordinator applies the sweep dataset through the new
-- admin write paths after this ships.
--
-- customer_service_phone is the number AS PUBLISHED (display form); the row renders the
-- stored value and derives the tel: href from it at render. customer_service_email is the
-- full published address. Both are SEPARATE from the private contact_email, which this
-- migration does not touch.
ALTER TABLE `sellers` ADD COLUMN `customer_service_phone` text;
--> statement-breakpoint
ALTER TABLE `sellers` ADD COLUMN `customer_service_email` text;
--> statement-breakpoint
-- One seller's recorded location set: address lines as published (street/PO Box nullable;
-- city + state are the minimum granularity), kind (NULL = recorded "undetermined", stored
-- but never rendered), exactly one primary per seller (enforced in the write path), and
-- provenance (source URL + checked date, the sweep dataset's standard).
CREATE TABLE `seller_locations` (
	`id` integer PRIMARY KEY NOT NULL,
	`seller_id` integer NOT NULL REFERENCES `sellers`(`id`),
	`kind` text,
	`street` text,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`zip` text,
	`is_primary` integer NOT NULL DEFAULT false,
	`source_url` text NOT NULL,
	`checked_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `seller_locations_kind_chk` CHECK (`kind` IN ('physical', 'warehouse', 'mailing'))
);
--> statement-breakpoint
CREATE INDEX `seller_locations_seller_idx` ON `seller_locations` (`seller_id`);
