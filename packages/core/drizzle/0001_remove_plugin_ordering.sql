-- Drop deprecated ordering and run_on columns from plugins table
-- These columns are no longer used - plugin execution order is determined by priority field

-- SQLite doesn't support DROP COLUMN directly, so we need to recreate the table
-- Step 1: Create new table without the deprecated columns
CREATE TABLE `plugins_new` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`service_id` text,
	`route_id` text,
	`consumer_id` text,
	`config` text,
	`enabled` integer DEFAULT true,
	`tags` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`route_id`) REFERENCES `routes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`consumer_id`) REFERENCES `consumers`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Step 2: Copy data from old table to new table (excluding deprecated columns)
INSERT INTO `plugins_new` (`id`, `name`, `service_id`, `route_id`, `consumer_id`, `config`, `enabled`, `tags`, `created_at`, `updated_at`)
SELECT `id`, `name`, `service_id`, `route_id`, `consumer_id`, `config`, `enabled`, `tags`, `created_at`, `updated_at`
FROM `plugins`;

-- Step 3: Drop the old table
DROP TABLE `plugins`;

-- Step 4: Rename the new table to plugins
ALTER TABLE `plugins_new` RENAME TO `plugins`;

-- Step 5: Recreate indexes
CREATE INDEX `idx_plugins_service_id` ON `plugins` (`service_id`);
CREATE INDEX `idx_plugins_route_id` ON `plugins` (`route_id`);
CREATE INDEX `idx_plugins_consumer_id` ON `plugins` (`consumer_id`);
