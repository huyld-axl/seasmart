-- Migration 020: drop training_center/course/enrollment tables
-- Purpose: disable training_center/course/enrollment processing; keep certificate CRUD independent.
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `training_enrollment`;
DROP TABLE IF EXISTS `enrollment_score`;
DROP TABLE IF EXISTS `enrollment_waitlist`;
DROP TABLE IF EXISTS `qr_enrollment_link`;
DROP TABLE IF EXISTS `training_center_course`;
DROP TABLE IF EXISTS `training_course`;
DROP TABLE IF EXISTS `training_center`;

SET FOREIGN_KEY_CHECKS = 1;

