CREATE TABLE IF NOT EXISTS `plugin_llm_router_circuits` (
	`plugin_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`state` text NOT NULL,
	`consecutive_failures` integer NOT NULL,
	`consecutive_successes` integer NOT NULL,
	`request_count` integer NOT NULL,
	`failure_count` integer NOT NULL,
	`opened_at` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`plugin_id`, `provider_name`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_plugin_llm_router_circuits_state` ON `plugin_llm_router_circuits` (`state`,`updated_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `plugin_llm_router_request_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`plugin_id` text NOT NULL,
	`request_id` text NOT NULL,
	`client_type` text NOT NULL,
	`provider_name` text NOT NULL,
	`model` text,
	`status_code` integer,
	`latency_ms` integer NOT NULL,
	`failure_reason` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_plugin_llm_router_request_logs_request_id` ON `plugin_llm_router_request_logs` (`request_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_plugin_llm_router_request_logs_provider` ON `plugin_llm_router_request_logs` (`provider_name`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `plugin_rate_limit_counters` (
	`plugin_id` text NOT NULL,
	`identifier` text NOT NULL,
	`count` integer NOT NULL,
	`window_started_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`plugin_id`, `identifier`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_plugin_rate_limit_counters_expires_at` ON `plugin_rate_limit_counters` (`expires_at`);
