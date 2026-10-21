CREATE TABLE `cash` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`order_id` text,
	`kind` text NOT NULL,
	`amount` integer NOT NULL,
	`category` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`voided` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cash_owner_date` ON `cash` (`owner`,`date`);--> statement-breakpoint
CREATE INDEX `idx_cash_order` ON `cash` (`order_id`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_clients_owner` ON `clients` (`owner`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`color` text NOT NULL,
	`stock_g` real DEFAULT 0 NOT NULL,
	`min_g` real DEFAULT 200 NOT NULL,
	`price_kg` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_materials_owner` ON `materials` (`owner`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`client_id` text,
	`quantity` integer NOT NULL,
	`status` text NOT NULL,
	`due_date` text DEFAULT '' NOT NULL,
	`total` integer DEFAULT 0 NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_orders_owner` ON `orders` (`owner`);--> statement-breakpoint
CREATE TABLE `settings` (
	`owner` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_moves` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`material_id` text NOT NULL,
	`order_id` text,
	`grams` real NOT NULL,
	`note` text NOT NULL,
	`applied` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_stock_moves_owner` ON `stock_moves` (`owner`);