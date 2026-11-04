CREATE TABLE `course_connections` (
	`release_id` text NOT NULL,
	`connection_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`release_id`, `connection_id`),
	FOREIGN KEY (`release_id`) REFERENCES `course_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_connections_release_order` ON `course_connections` (`release_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `course_connections_id_release` ON `course_connections` (`connection_id`,`release_id`);--> statement-breakpoint
CREATE TABLE `course_reference_relationships` (
	`release_id` text NOT NULL,
	`relationship_id` text NOT NULL,
	`sort_order` integer NOT NULL,
	`payload_json` text NOT NULL,
	PRIMARY KEY(`release_id`, `relationship_id`),
	FOREIGN KEY (`release_id`) REFERENCES `course_releases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_reference_relationships_release_order` ON `course_reference_relationships` (`release_id`,`sort_order`);