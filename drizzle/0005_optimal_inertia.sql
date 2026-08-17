CREATE TABLE `case_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`from_status` text NOT NULL,
	`to_status` text NOT NULL,
	`from_username` text NOT NULL,
	`to_username` text,
	`reason` text NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `case_sequences` (
	`year` text PRIMARY KEY NOT NULL,
	`last_value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text NOT NULL,
	`advisor_id` text,
	`must_change_password` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `staff_users_username_unique` ON `staff_users` (`username`);--> statement-breakpoint
ALTER TABLE `advisors` ADD `source_username` text;--> statement-breakpoint
ALTER TABLE `advisors` ADD `special_role` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `tracking_password_hash` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `upload_token_hash` text;--> statement-breakpoint
ALTER TABLE `cases` ADD `upload_token_expires_at` text;--> statement-breakpoint
ALTER TABLE `case_notes` ADD `is_editable` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `students` ADD `student_card_number` text;--> statement-breakpoint
ALTER TABLE `students` ADD `tracking_password_hash` text;