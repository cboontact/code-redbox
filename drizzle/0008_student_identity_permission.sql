ALTER TABLE `staff_users` ADD `can_view_student_identity` integer DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE `staff_users` SET `can_view_student_identity`=1
WHERE `role`='SUPER_ADMIN'
   OR `id` IN (SELECT `user_id` FROM `staff_user_roles` WHERE `role`='SUPER_ADMIN');
