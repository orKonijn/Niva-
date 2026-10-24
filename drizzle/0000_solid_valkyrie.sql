CREATE TABLE `niva_pilot_feed` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`fetched_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `niva_pilot_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `niva_pilot_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`window` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `niva_pilot_states` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer NOT NULL,
	`data` text NOT NULL,
	`imported_at` text,
	`updated_at` text NOT NULL
);
