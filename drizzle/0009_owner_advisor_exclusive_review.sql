ALTER TABLE `cases` ADD `exclusive_reviewer_username` text;
--> statement-breakpoint
CREATE INDEX `idx_cases_exclusive_review` ON `cases` (`exclusive_reviewer_username`,`status`);
--> statement-breakpoint
UPDATE `cases` SET `exclusive_reviewer_username`='cboonta'
WHERE `status` IN ('NEW','REOPENED') AND EXISTS (
  SELECT 1 FROM `students` s
  JOIN `advisor_assignments` aa ON aa.`level`=s.`level` AND aa.`classroom`=s.`classroom`
  JOIN `advisors` a ON a.`id`=aa.`advisor_id`
  WHERE s.`id`=`cases`.`student_id` AND a.`source_username`='cboonta'
);
