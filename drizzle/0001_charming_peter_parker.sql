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

--> statement-breakpoint
-- Preserve historical hosted snapshots, including removed jobs already saved by an owner.
INSERT INTO niva_jobs(id,source_id,canonical,company,title,district,category,style,search,active,version,data)
SELECT id,'greenhouse-appsflyer',json_extract(data,'$.source.applicationUrl'),
 lower(json_extract(data,'$.company')),lower(json_extract(data,'$.title')),
 coalesce(json_extract(data,'$.district'),'unknown'),coalesce(json_extract(data,'$.category'),'other'),
 coalesce(json_extract(data,'$.workStyle'),'unknown'),
 lower(json_extract(data,'$.title') || ' ' || json_extract(data,'$.company')),
 active,coalesce(json_extract(data,'$.source.version'),'legacy-' || id),data
FROM niva_pilot_jobs
WHERE json_valid(data) AND json_extract(data,'$.source.applicationUrl') IS NOT NULL
 AND json_extract(data,'$.title') IS NOT NULL AND json_extract(data,'$.company') IS NOT NULL
ON CONFLICT(id) DO NOTHING;
