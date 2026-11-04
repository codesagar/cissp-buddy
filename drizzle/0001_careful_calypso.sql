CREATE TABLE `course_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`source_hash` text NOT NULL,
	`published_at` text NOT NULL,
	`manifest_json` text NOT NULL,
	`unit_count` integer NOT NULL,
	`concept_count` integer NOT NULL,
	`concept_occurrence_count` integer NOT NULL,
	`teaching_model_count` integer NOT NULL,
	`assessment_count` integer NOT NULL,
	`sealed` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE INDEX `course_releases_source_hash` ON `course_releases` (`source_hash`);--> statement-breakpoint
CREATE TABLE `course_source_bindings` (
	`release_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`concept_id` text NOT NULL,
	`source_visual_id` text NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`release_id`, `unit_id`, `concept_id`),
	FOREIGN KEY (`release_id`) REFERENCES `course_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_source_bindings_release_unit` ON `course_source_bindings` (`release_id`,`unit_id`);--> statement-breakpoint
CREATE TABLE `course_units` (
	`release_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`domain_id` integer NOT NULL,
	`sort_order` integer NOT NULL,
	`source_hash` text NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`release_id`, `unit_id`),
	FOREIGN KEY (`release_id`) REFERENCES `course_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_units_release_domain_order` ON `course_units` (`release_id`,`domain_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `course_units_unit_release` ON `course_units` (`unit_id`,`release_id`);