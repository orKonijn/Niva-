CREATE TABLE `niva_career_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `niva_documents` (
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL,
	PRIMARY KEY(`owner`, `kind`, `id`)
);
--> statement-breakpoint
CREATE INDEX `niva_documents_expiry` ON `niva_documents` (`expires_at`);--> statement-breakpoint
CREATE TABLE `niva_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`canonical` text NOT NULL,
	`company` text NOT NULL,
	`title` text NOT NULL,
	`district` text NOT NULL,
	`category` text NOT NULL,
	`style` text NOT NULL,
	`search` text NOT NULL,
	`active` integer NOT NULL,
	`version` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `niva_jobs_filters` ON `niva_jobs` (`active`,`category`,`district`,`style`,`id`);--> statement-breakpoint
CREATE INDEX `niva_jobs_source` ON `niva_jobs` (`source_id`,`active`);--> statement-breakpoint
CREATE INDEX `niva_jobs_canonical` ON `niva_jobs` (`canonical`);--> statement-breakpoint
CREATE TABLE `niva_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`checked_at` text,
	`next_at` integer DEFAULT 0 NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`error` text,
	`lease_until` integer DEFAULT 0 NOT NULL
);
