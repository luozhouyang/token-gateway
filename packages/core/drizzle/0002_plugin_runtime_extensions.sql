CREATE TABLE `plugin_bundles` (
	`name` text PRIMARY KEY NOT NULL,
	`version` text NOT NULL,
	`checksum` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `plugin_migrations` (
	`plugin_name` text NOT NULL,
	`migration_id` text NOT NULL,
	`checksum` text NOT NULL,
	`applied_at` text,
	PRIMARY KEY(`plugin_name`, `migration_id`),
	FOREIGN KEY (`plugin_name`) REFERENCES `plugin_bundles`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_plugin_migrations_plugin_name` ON `plugin_migrations` (`plugin_name`);
