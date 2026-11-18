-- Phase 3 (seeds-v2 brief #3 + addenda 1–7): accounts, sessions, one-time email + alert-number
-- verification codes, waiting lists, the notification outbox (email + SMS), Add Your Farm
-- submissions (with the auto-drafted summary columns) and the farm-owner audit trail.
-- Design: USER-ACCOUNTS-DESIGN.md §2/§2a/§4/§4a/§5/§9, PRODUCT-DESIGN.md §3.
--
-- Additive only. Every table here is PRIVATE: excluded from the snapshot allowlist, the sync
-- payloads and the public API (guardrail: tests/unit/account-privacy.test.ts).
-- Catalog ids (variety_id, listing_id, seller_id) are plain integers with no FK, like the event
-- tables in 0002: the catalog importer deletes and re-creates catalog rows with the same ids, and
-- an FK from account data would block that full-replace import.
--
-- `users` is the Phase 1 stub (id, email NOT NULL UNIQUE, display_name, created_at), extended in
-- place. Its email NOT NULL + UNIQUE stays: the IVR-phase phone-only accounts (design §4a) will
-- need email relaxed via a table rebuild in that phase. SQLite cannot add a table-level CHECK
-- with ALTER TABLE, so users_status_chk is attached as a column constraint (same predicate as
-- lib/db/schema.ts).
ALTER TABLE `users` ADD COLUMN `name` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `phone` text NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `zip` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `usda_zone` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_verified` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `email_verified_at` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `notify_opt_out` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `status` text NOT NULL DEFAULT 'active' CONSTRAINT `users_status_chk` CHECK (status IN ('active', 'banned'));
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `farm_owner_declared` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `is_farm_owner` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `seller_id` integer;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `alert_phone` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `alert_phone_verified` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `sms_opt_in` integer NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `sms_opt_in_at` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `updated_at` text;
--> statement-breakpoint
CREATE INDEX `users_phone_idx` ON `users` (`phone`);
--> statement-breakpoint
CREATE INDEX `users_alert_phone_idx` ON `users` (`alert_phone`);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`last_seen_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);
--> statement-breakpoint
CREATE TABLE `auth_attempts` (
	`id` integer PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`key_hash` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "auth_attempts_scope_chk" CHECK(scope IN ('ip', 'pair'))
);
--> statement-breakpoint
CREATE INDEX `auth_attempts_key_idx` ON `auth_attempts` (`scope`,`key_hash`,`created_at`);
--> statement-breakpoint
CREATE TABLE `email_verification_codes` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`email` text NOT NULL,
	`code_hash` text NOT NULL,
	`salt` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`invalidated_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `email_codes_user_idx` ON `email_verification_codes` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `phone_verification_codes` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`phone` text NOT NULL,
	`code_hash` text NOT NULL,
	`salt` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`invalidated_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `phone_codes_user_idx` ON `phone_verification_codes` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `farm_owner_audit` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`seller_id` integer,
	`created_at` text NOT NULL,
	CONSTRAINT "farm_owner_audit_action_chk" CHECK(action IN ('granted', 'revoked'))
);
--> statement-breakpoint
CREATE INDEX `farm_owner_audit_user_idx` ON `farm_owner_audit` (`user_id`);
--> statement-breakpoint
CREATE TABLE `waitlist_entries` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`variety_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`notified_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `waitlist_user_variety_uq` ON `waitlist_entries` (`user_id`,`variety_id`);
--> statement-breakpoint
CREATE INDEX `waitlist_variety_idx` ON `waitlist_entries` (`variety_id`,`notified_at`);
--> statement-breakpoint
CREATE TABLE `notification_outbox` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`variety_id` integer NOT NULL,
	`listing_id` integer NOT NULL,
	`channel` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`queued_at` text NOT NULL,
	`sent_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`detail` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "outbox_channel_chk" CHECK(channel IN ('email', 'sms')),
	CONSTRAINT "outbox_status_chk" CHECK(status IN ('queued', 'sent', 'suppressed', 'failed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `outbox_user_variety_channel_uq` ON `notification_outbox` (`user_id`,`variety_id`,`channel`);
--> statement-breakpoint
CREATE INDEX `outbox_status_channel_idx` ON `notification_outbox` (`status`,`channel`,`queued_at`);
--> statement-breakpoint
CREATE TABLE `farm_submissions` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer,
	`farm_name` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`city` text NOT NULL,
	`state` text NOT NULL,
	`website` text NOT NULL,
	`grows_text` text NOT NULL,
	`varieties_text` text NOT NULL,
	`authorized` integer NOT NULL,
	`business_phone` text NOT NULL,
	`gbp_url` text,
	`instagram_url` text,
	`tiktok_url` text,
	`facebook_url` text,
	`wholesale` integer,
	`notes` text,
	`turnstile` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`reviewed_at` text,
	`reviewed_by` text,
	`seller_id` integer,
	`draft_status` text DEFAULT 'pending' NOT NULL,
	`draft_summary` text,
	`draft_evidence` text,
	`suggested_fields` text,
	`draft_note` text,
	`drafted_at` text,
	CONSTRAINT "farm_submissions_status_chk" CHECK(status IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "farm_submissions_draft_status_chk" CHECK(draft_status IN ('pending', 'ready', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `farm_submissions_status_idx` ON `farm_submissions` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `farm_submissions_email_idx` ON `farm_submissions` (`contact_email`);
--> statement-breakpoint
CREATE INDEX `farm_submissions_state_idx` ON `farm_submissions` (`state`);
