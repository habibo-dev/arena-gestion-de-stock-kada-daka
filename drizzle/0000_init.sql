CREATE TABLE `brands` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`country` text,
	`is_oem` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brands_normalized_idx` ON `brands` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_idx` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `compatibilities` (
	`part_id` integer NOT NULL,
	`vehicle_id` integer NOT NULL,
	`status` text DEFAULT 'UNVERIFIED' NOT NULL,
	`source` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`part_id`, `vehicle_id`),
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `compat_vehicle_idx` ON `compatibilities` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `compat_part_idx` ON `compatibilities` (`part_id`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`customer_type` text DEFAULT 'PARTICULIER' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customers_name_idx` ON `customers` (`name`);--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`file_name` text NOT NULL,
	`sheet_name` text NOT NULL,
	`total_rows` integer NOT NULL,
	`imported_rows` integer NOT NULL,
	`updated_rows` integer DEFAULT 0 NOT NULL,
	`skipped_rows` integer NOT NULL,
	`mapping` text NOT NULL,
	`user_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`label` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_code_idx` ON `locations` (`code`);--> statement-breakpoint
CREATE TABLE `part_references` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_id` integer NOT NULL,
	`type` text NOT NULL,
	`reference` text NOT NULL,
	`reference_normalized` text NOT NULL,
	`brand_id` integer,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `part_refs_part_idx` ON `part_references` (`part_id`);--> statement-breakpoint
CREATE INDEX `part_refs_norm_idx` ON `part_references` (`reference_normalized`);--> statement-breakpoint
CREATE INDEX `part_refs_ref_idx` ON `part_references` (`reference`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`reference_normalized` text NOT NULL,
	`reference_raw` text,
	`designation` text NOT NULL,
	`description` text,
	`brand_id` integer,
	`category_id` integer,
	`location_id` integer,
	`supplier_id` integer,
	`unit` text DEFAULT 'Pièce' NOT NULL,
	`purchase_price` real DEFAULT 0 NOT NULL,
	`wholesale_price` real DEFAULT 0 NOT NULL,
	`retail_price` real DEFAULT 0 NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`min_stock` integer DEFAULT 0 NOT NULL,
	`barcode` text,
	`image_path` text,
	`notes` text,
	`keywords` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parts_reference_idx` ON `parts` (`reference`);--> statement-breakpoint
CREATE INDEX `parts_reference_norm_idx` ON `parts` (`reference_normalized`);--> statement-breakpoint
CREATE INDEX `parts_designation_idx` ON `parts` (`designation`);--> statement-breakpoint
CREATE INDEX `parts_brand_idx` ON `parts` (`brand_id`);--> statement-breakpoint
CREATE INDEX `parts_category_idx` ON `parts` (`category_id`);--> statement-breakpoint
CREATE INDEX `parts_location_idx` ON `parts` (`location_id`);--> statement-breakpoint
CREATE INDEX `parts_supplier_idx` ON `parts` (`supplier_id`);--> statement-breakpoint
CREATE INDEX `parts_barcode_idx` ON `parts` (`barcode`);--> statement-breakpoint
CREATE INDEX `parts_quantity_idx` ON `parts` (`quantity`);--> statement-breakpoint
CREATE INDEX `parts_active_idx` ON `parts` (`is_active`);--> statement-breakpoint
CREATE TABLE `purchase_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`purchase_id` integer NOT NULL,
	`part_id` integer NOT NULL,
	`reference` text NOT NULL,
	`designation` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` real NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `purchase_items_purchase_idx` ON `purchase_items` (`purchase_id`);--> statement-breakpoint
CREATE INDEX `purchase_items_part_idx` ON `purchase_items` (`part_id`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`status` text DEFAULT 'BROUILLON' NOT NULL,
	`supplier_id` integer,
	`supplier_invoice_number` text,
	`subtotal` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`notes` text,
	`user_id` integer,
	`ordered_at` text,
	`received_at` text,
	`cancelled_at` text,
	`expected_at` text,
	`purchase_date` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchases_number_idx` ON `purchases` (`number`);--> statement-breakpoint
CREATE INDEX `purchases_status_idx` ON `purchases` (`status`);--> statement-breakpoint
CREATE INDEX `purchases_date_idx` ON `purchases` (`purchase_date`);--> statement-breakpoint
CREATE INDEX `purchases_supplier_idx` ON `purchases` (`supplier_id`);--> statement-breakpoint
CREATE TABLE `sale_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sale_id` integer NOT NULL,
	`part_id` integer NOT NULL,
	`reference` text NOT NULL,
	`designation` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `sale_items_sale_idx` ON `sale_items` (`sale_id`);--> statement-breakpoint
CREATE INDEX `sale_items_part_idx` ON `sale_items` (`part_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`status` text DEFAULT 'BROUILLON' NOT NULL,
	`customer_id` integer,
	`customer_name` text,
	`customer_phone` text,
	`price_tier` text DEFAULT 'DETAIL' NOT NULL,
	`payment_method` text DEFAULT 'ESPECES' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount_type` text DEFAULT 'NONE' NOT NULL,
	`discount_value` real DEFAULT 0 NOT NULL,
	`discount_amount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`notes` text,
	`user_id` integer,
	`confirmed_at` text,
	`cancelled_at` text,
	`sale_date` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_number_idx` ON `sales` (`number`);--> statement-breakpoint
CREATE INDEX `sales_status_idx` ON `sales` (`status`);--> statement-breakpoint
CREATE INDEX `sales_date_idx` ON `sales` (`sale_date`);--> statement-breakpoint
CREATE INDEX `sales_customer_idx` ON `sales` (`customer_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`part_id` integer NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`previous_quantity` integer NOT NULL,
	`new_quantity` integer NOT NULL,
	`unit_cost` real,
	`reason` text,
	`document_type` text,
	`document_id` integer,
	`document_number` text,
	`from_location_id` integer,
	`to_location_id` integer,
	`user_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`part_id`) REFERENCES `parts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`to_location_id`) REFERENCES `locations`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `movements_part_idx` ON `stock_movements` (`part_id`);--> statement-breakpoint
CREATE INDEX `movements_created_idx` ON `stock_movements` (`created_at`);--> statement-breakpoint
CREATE INDEX `movements_type_idx` ON `stock_movements` (`type`);--> statement-breakpoint
CREATE INDEX `movements_document_idx` ON `stock_movements` (`document_type`,`document_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`contact_name` text,
	`phone` text,
	`email` text,
	`address` text,
	`city` text,
	`notes` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `suppliers_name_idx` ON `suppliers` (`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_login_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `vehicle_makes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`country` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vehicle_makes_norm_idx` ON `vehicle_makes` (`normalized_name`);--> statement-breakpoint
CREATE TABLE `vehicle_models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`make_id` integer NOT NULL,
	`name` text NOT NULL,
	`generation` text,
	`year_from` integer,
	`year_to` integer,
	`body_type` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`make_id`) REFERENCES `vehicle_makes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vehicle_models_make_idx` ON `vehicle_models` (`make_id`);--> statement-breakpoint
CREATE INDEX `vehicle_models_name_idx` ON `vehicle_models` (`name`);--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` integer NOT NULL,
	`engine_label` text NOT NULL,
	`displacement` text,
	`fuel` text,
	`power_hp` integer,
	`power_kw` integer,
	`engine_code` text,
	`year_from` integer,
	`year_to` integer,
	`search_text` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `vehicle_models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `vehicles_model_idx` ON `vehicles` (`model_id`);--> statement-breakpoint
CREATE INDEX `vehicles_engine_code_idx` ON `vehicles` (`engine_code`);--> statement-breakpoint
CREATE INDEX `vehicles_search_idx` ON `vehicles` (`search_text`);