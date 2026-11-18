CREATE TABLE `catalog_publish` (
	`version` integer PRIMARY KEY NOT NULL,
	`batch_id` integer NOT NULL,
	`snapshot_key` text,
	`published_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `catalog_publish_batch_idx` ON `catalog_publish` (`batch_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`source_id` integer,
	`manifest` text NOT NULL,
	`status` text DEFAULT 'staged' NOT NULL,
	`created_at` text NOT NULL,
	`published_at` text,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "import_batches_status_chk" CHECK(status IN ('staged', 'published', 'rolled_back'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batches_label_unique` ON `import_batches` (`label`);--> statement-breakpoint
CREATE TABLE `listing_packet_sizes` (
	`id` integer PRIMARY KEY NOT NULL,
	`listing_id` integer NOT NULL,
	`label` text NOT NULL,
	`seed_count` integer,
	`price_cents` integer,
	`currency` text DEFAULT 'USD' NOT NULL,
	`price_source` text,
	`price_check_date` text,
	`in_stock` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packet_sizes_price_provenance_chk" CHECK(price_cents IS NULL OR (price_source IS NOT NULL AND price_check_date IS NOT NULL)),
	CONSTRAINT "packet_sizes_price_chk" CHECK(price_cents IS NULL OR price_cents >= 0)
);
--> statement-breakpoint
CREATE INDEX `packet_sizes_listing_price_idx` ON `listing_packet_sizes` (`listing_id`,`price_cents`);--> statement-breakpoint
CREATE TABLE `listings` (
	`id` integer PRIMARY KEY NOT NULL,
	`variety_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`source_id` integer NOT NULL,
	`sku` text,
	`product_url` text,
	`notes` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`variety_id`) REFERENCES `varieties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "listings_status_chk" CHECK(status IN ('active', 'inactive', 'unverified'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `listings_variety_seller_uq` ON `listings` (`variety_id`,`seller_id`);--> statement-breakpoint
CREATE INDEX `listings_seller_idx` ON `listings` (`seller_id`);--> statement-breakpoint
CREATE INDEX `listings_source_idx` ON `listings` (`source_id`);--> statement-breakpoint
CREATE INDEX `listings_status_idx` ON `listings` (`status`);--> statement-breakpoint
CREATE TABLE `match_queue` (
	`id` integer PRIMARY KEY NOT NULL,
	`batch_id` integer NOT NULL,
	`candidate_payload` text NOT NULL,
	`confidence` real,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "match_queue_status_chk" CHECK(status IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE INDEX `match_queue_batch_idx` ON `match_queue` (`batch_id`);--> statement-breakpoint
CREATE TABLE `media` (
	`id` integer PRIMARY KEY NOT NULL,
	`variety_id` integer,
	`seller_id` integer,
	`r2_key` text NOT NULL,
	`licence` text NOT NULL,
	`credit` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`variety_id`) REFERENCES `varieties`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `media_variety_idx` ON `media` (`variety_id`);--> statement-breakpoint
CREATE INDEX `media_seller_idx` ON `media` (`seller_id`);--> statement-breakpoint
CREATE TABLE `outbound_clicks` (
	`id` integer PRIMARY KEY NOT NULL,
	`listing_id` integer,
	`seller_id` integer NOT NULL,
	`target_url` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `outbound_clicks_seller_idx` ON `outbound_clicks` (`seller_id`);--> statement-breakpoint
CREATE INDEX `outbound_clicks_listing_idx` ON `outbound_clicks` (`listing_id`);--> statement-breakpoint
CREATE TABLE `plants` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`common_name` text NOT NULL,
	`latin_name` text NOT NULL,
	`description` text,
	`sowing_notes` text,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plants_slug_unique` ON `plants` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `plants_names_uq` ON `plants` (`common_name`,`latin_name`);--> statement-breakpoint
CREATE INDEX `plants_category_idx` ON `plants` (`category_id`);--> statement-breakpoint
CREATE TABLE `price_history` (
	`id` integer PRIMARY KEY NOT NULL,
	`packet_size_id` integer NOT NULL,
	`price_cents` integer,
	`checked_date` text NOT NULL,
	`source_id` integer NOT NULL,
	FOREIGN KEY (`packet_size_id`) REFERENCES `listing_packet_sizes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `price_history_packet_idx` ON `price_history` (`packet_size_id`);--> statement-breakpoint
CREATE INDEX `price_history_source_idx` ON `price_history` (`source_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`body` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "reviews_rating_chk" CHECK(rating BETWEEN 1 AND 5),
	CONSTRAINT "reviews_status_chk" CHECK(status IN ('pending', 'approved', 'rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_user_seller_uq` ON `reviews` (`user_id`,`seller_id`);--> statement-breakpoint
CREATE INDEX `reviews_seller_idx` ON `reviews` (`seller_id`);--> statement-breakpoint
CREATE TABLE `seller_accounts` (
	`user_id` integer NOT NULL,
	`seller_id` integer NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`user_id`, `seller_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`seller_id`) REFERENCES `sellers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `seller_accounts_seller_idx` ON `seller_accounts` (`seller_id`);--> statement-breakpoint
CREATE TABLE `sellers` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`homepage` text,
	`description` text,
	`ordering_notes` text,
	`location` text,
	`status` text DEFAULT 'active' NOT NULL,
	`provenance` text NOT NULL,
	`listing_policy` text DEFAULT 'full' NOT NULL,
	`platform` text,
	`rating_count` integer DEFAULT 0 NOT NULL,
	`rating_sum` integer DEFAULT 0 NOT NULL,
	`rating_average` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "sellers_type_chk" CHECK(type IN ('wholesale', 'retail', 'specialty')),
	CONSTRAINT "sellers_status_chk" CHECK(status IN ('active', 'inactive', 'pending')),
	CONSTRAINT "sellers_provenance_chk" CHECK(provenance IN ('owner-named', 'research-candidate', 'sourcing-check')),
	CONSTRAINT "sellers_listing_policy_chk" CHECK(listing_policy IN ('full', 'no_prices', 'removed')),
	CONSTRAINT "sellers_platform_chk" CHECK(platform IS NULL OR platform IN ('shopify', 'woocommerce', 'squarespace', 'other')),
	CONSTRAINT "sellers_rating_average_chk" CHECK(rating_count > 0 OR rating_average IS NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sellers_slug_unique` ON `sellers` (`slug`);--> statement-breakpoint
CREATE INDEX `sellers_status_name_idx` ON `sellers` (`status`,`name`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`label` text NOT NULL,
	`url` text,
	`checked_date` text,
	`access` text DEFAULT 'public' NOT NULL,
	CONSTRAINT "sources_kind_chk" CHECK(kind IN ('catalog', 'shop-check', 'research', 'owner')),
	CONSTRAINT "sources_access_chk" CHECK(access IN ('public', 'login_gated'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_slug_unique` ON `sources` (`slug`);--> statement-breakpoint
CREATE TABLE `subcategories` (
	`id` integer PRIMARY KEY NOT NULL,
	`category_id` integer NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subcategories_category_slug_uq` ON `subcategories` (`category_id`,`slug`);--> statement-breakpoint
CREATE INDEX `subcategories_category_idx` ON `subcategories` (`category_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `varieties` (
	`id` integer PRIMARY KEY NOT NULL,
	`plant_id` integer NOT NULL,
	`slug` text NOT NULL,
	`variety_name` text NOT NULL,
	`category_id` integer NOT NULL,
	`subcategory_id` integer,
	`description` text,
	`sowing_notes` text,
	`height_cm` integer,
	`color_swatch` text,
	`status` text DEFAULT 'active' NOT NULL,
	`content_level` text DEFAULT 'thin' NOT NULL,
	`indexable` integer DEFAULT false NOT NULL,
	`protection` text DEFAULT 'unknown' NOT NULL,
	`protection_note` text,
	`source_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`plant_id`) REFERENCES `plants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subcategory_id`) REFERENCES `subcategories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "varieties_status_chk" CHECK(status IN ('active', 'draft', 'discontinued')),
	CONSTRAINT "varieties_content_level_chk" CHECK(content_level IN ('thin', 'factual')),
	CONSTRAINT "varieties_protection_chk" CHECK(protection IN ('pvp_us', 'utility_patent_us', 'pbr', 'none_stated', 'unknown')),
	CONSTRAINT "varieties_height_chk" CHECK(height_cm IS NULL OR height_cm > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `varieties_slug_unique` ON `varieties` (`slug`);--> statement-breakpoint
CREATE INDEX `varieties_plant_idx` ON `varieties` (`plant_id`);--> statement-breakpoint
CREATE INDEX `varieties_category_idx` ON `varieties` (`category_id`);--> statement-breakpoint
CREATE INDEX `varieties_subcategory_idx` ON `varieties` (`subcategory_id`);--> statement-breakpoint
CREATE INDEX `varieties_source_idx` ON `varieties` (`source_id`);--> statement-breakpoint
CREATE INDEX `varieties_status_name_idx` ON `varieties` (`status`,`variety_name`);--> statement-breakpoint
CREATE TABLE `variety_aliases` (
	`variety_id` integer NOT NULL,
	`alias` text NOT NULL,
	PRIMARY KEY(`variety_id`, `alias`),
	FOREIGN KEY (`variety_id`) REFERENCES `varieties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `variety_tags` (
	`variety_id` integer NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`variety_id`, `tag`),
	FOREIGN KEY (`variety_id`) REFERENCES `varieties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `variety_tags_tag_idx` ON `variety_tags` (`tag`);