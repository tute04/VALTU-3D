CREATE TABLE `config` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_products_owner` ON `products` (`owner`);--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`material_id` text NOT NULL,
	`quantity` real NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`voided` integer DEFAULT 0 NOT NULL,
	`reversed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_purchases_owner` ON `purchases` (`owner`);--> statement-breakpoint
CREATE TABLE `restores` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace_meta` (
	`owner` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cash` ADD `account` text DEFAULT 'unassigned' NOT NULL;--> statement-breakpoint
ALTER TABLE `cash` ADD `transfer_to` text;--> statement-breakpoint
ALTER TABLE `cash` ADD `purchase_id` text;--> statement-breakpoint
ALTER TABLE `materials` ADD `unit` text DEFAULT 'g' NOT NULL;--> statement-breakpoint
ALTER TABLE `materials` ADD `unit_cost` integer DEFAULT 0 NOT NULL;