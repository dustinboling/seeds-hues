-- Small farm badge (Open Directory, 2026-11-19): a recorded judgment call on the seller,
-- not a measured size. Additive only: existing sellers default to 0 (no badge); the
-- classification backfill (seller-classification.md) sets the approved slugs afterwards.
ALTER TABLE `sellers` ADD COLUMN `is_small_farm` integer DEFAULT 0 NOT NULL;
