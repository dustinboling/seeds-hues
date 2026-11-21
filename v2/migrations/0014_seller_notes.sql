-- Slice B (sellers): the seller internal-notes store (spec §13.4). Append-only team memory
-- about a seller — PRIVATE, served only through admin-session-authorized handlers, never in
-- any public payload. Additive only: one new table + index, no existing table touched.
CREATE TABLE `seller_notes` (
	`id` integer PRIMARY KEY NOT NULL,
	`seller_id` integer NOT NULL REFERENCES `sellers`(`id`),
	`author_user_id` integer NOT NULL,
	`author_name` text NOT NULL,
	`author_role` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `seller_notes_seller_created_idx` ON `seller_notes` (`seller_id`,`created_at`);
