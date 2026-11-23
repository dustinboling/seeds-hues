-- Tranche 3.2 (waitlist flip, SPEC §3.3 (iii)): the recognized-contact pending join. When
-- an existing email is submitted to the join path, the code issued for it is recorded here
-- together with the variety it was issued for (plus the submitter's channel choice, applied
-- at verify time). One row per user (user_id PK): a re-issue replaces it, mirroring the
-- one-live-code rule; verification consumes it when the session is established and the join
-- completes in the same step. PRIVATE like every other account table (added to
-- PRIVATE_ACCOUNT_TABLES in lib/db/schema.ts). Additive only.
CREATE TABLE `waitlist_pending_joins` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`variety_id` integer NOT NULL,
	`phone` text,
	`sms_opt_in` integer NOT NULL DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
