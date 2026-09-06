CREATE TABLE `concepts` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`root_id` text NOT NULL,
	`domain_id` integer NOT NULL,
	`title` text NOT NULL,
	`sort_order` integer NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `concepts_parent_order` ON `concepts` (`parent_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `concepts_domain` ON `concepts` (`domain_id`);--> statement-breakpoint
CREATE TABLE `domains` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`payload_json` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `lessons` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`revision` integer NOT NULL,
	`status` text NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `lessons_concept` ON `lessons` (`concept_id`);--> statement-breakpoint
CREATE TABLE `question_learning_links` (
	`question_id` text NOT NULL,
	`lesson_id` text NOT NULL,
	`section_index` integer NOT NULL,
	`label` text NOT NULL,
	PRIMARY KEY(`question_id`, `lesson_id`, `section_index`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `question_subtopics` (
	`question_id` text NOT NULL,
	`concept_id` text NOT NULL,
	PRIMARY KEY(`question_id`, `concept_id`),
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `question_subtopics_concept` ON `question_subtopics` (`concept_id`);--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`concept_id` text NOT NULL,
	`domain_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`payload_json` text NOT NULL,
	FOREIGN KEY (`concept_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`domain_id`) REFERENCES `domains`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `questions_domain_concept` ON `questions` (`domain_id`,`concept_id`);--> statement-breakpoint
CREATE TABLE `concept_relationships` (
	`from_id` text NOT NULL,
	`to_id` text NOT NULL,
	`kind` text NOT NULL,
	PRIMARY KEY(`from_id`, `to_id`, `kind`),
	FOREIGN KEY (`from_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_id`) REFERENCES `concepts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `relationships_to` ON `concept_relationships` (`to_id`);--> statement-breakpoint
CREATE TABLE `content_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`published_at` text NOT NULL,
	`manifest_json` text NOT NULL
);
