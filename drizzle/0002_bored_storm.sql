CREATE TABLE `niva_career_leases` (
	`owner` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`epoch` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `niva_career_owners` (
	`owner` text PRIMARY KEY NOT NULL,
	`epoch` text DEFAULT '0' NOT NULL,
	`active_resume_id` text
);
--> statement-breakpoint
CREATE TABLE `niva_maintenance` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer,
	`succeeded_at` integer,
	`error` text,
	`removed` integer DEFAULT 0 NOT NULL,
	`trigger` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `niva_documents` ADD `epoch` text DEFAULT '0' NOT NULL;