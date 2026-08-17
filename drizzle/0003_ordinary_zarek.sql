CREATE TABLE `advisor_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`advisor_id` text NOT NULL,
	`level` text NOT NULL,
	`classroom` text NOT NULL,
	`slot` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`advisor_id`) REFERENCES `advisors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `advisor_assignment_room_slot_unique` ON `advisor_assignments` (`level`,`classroom`,`slot`);--> statement-breakpoint
CREATE TABLE `advisors` (
	`id` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
