CREATE TABLE IF NOT EXISTS `llm_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text,
	`vendor` text DEFAULT 'custom' NOT NULL,
	`enabled` integer DEFAULT true,
	`protocol` text DEFAULT 'passthrough' NOT NULL,
	`base_url` text NOT NULL,
	`clients` text,
	`headers` text,
	`auth` text,
	`adapter_config` text,
	`tags` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `llm_providers_name_unique` ON `llm_providers` (`name`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_llm_providers_vendor` ON `llm_providers` (`vendor`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_llm_providers_protocol` ON `llm_providers` (`protocol`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_llm_providers_enabled` ON `llm_providers` (`enabled`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `llm_models` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`upstream_model` text NOT NULL,
	`enabled` integer DEFAULT true,
	`metadata` text,
	`tags` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`provider_id`) REFERENCES `llm_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_llm_models_provider_id` ON `llm_models` (`provider_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_llm_models_enabled` ON `llm_models` (`enabled`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `uq_llm_models_provider_name` ON `llm_models` (`provider_id`, `name`);
