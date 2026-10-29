USE `waterline_db`;

ALTER TABLE `consumers`
  ADD COLUMN `email` VARCHAR(255) DEFAULT NULL AFTER `username`,
  ADD COLUMN `google_verified_at` DATETIME DEFAULT NULL AFTER `approval_status`;
