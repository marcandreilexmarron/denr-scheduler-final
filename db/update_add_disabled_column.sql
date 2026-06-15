-- Add disabled column to office_users table
ALTER TABLE `office_users` 
ADD COLUMN `disabled` tinyint(1) NOT NULL DEFAULT 0 
AFTER `email`;
