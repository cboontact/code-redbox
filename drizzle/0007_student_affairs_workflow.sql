CREATE TABLE `case_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`case_id` text NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`assignment_role` text DEFAULT 'MEMBER' NOT NULL,
	`status` text DEFAULT 'ASSIGNED' NOT NULL,
	`assigned_by` text NOT NULL,
	`completed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `staff_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `case_assignments_case_user_unique` ON `case_assignments` (`case_id`,`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_case_assignments_user_status` ON `case_assignments` (`username`,`status`);
--> statement-breakpoint
UPDATE `cases` SET `severity`=CASE `severity`
	WHEN 'GENERAL' THEN 'WATCH'
	WHEN 'CONCERN' THEN 'MODERATE'
	WHEN 'SERIOUS' THEN 'SEVERE'
	ELSE `severity`
END WHERE `severity` IN ('GENERAL','CONCERN','SERIOUS');
