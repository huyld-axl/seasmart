-- 030_job_payment_records.sql
-- Multi-record payment schedule/history for each job

CREATE TABLE IF NOT EXISTS `job_payment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `job_id` INT NOT NULL,
  `payment_cycle_text` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `paid_at` DATETIME NULL,
  `notes` TEXT NULL,
  `attachment_original_name` VARCHAR(255) NULL,
  `attachment_stored_name` VARCHAR(255) NULL,
  `attachment_path` VARCHAR(500) NULL,
  `attachment_url` VARCHAR(500) NULL,
  `attachment_mime_type` VARCHAR(100) NULL,
  `attachment_size` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT NOW(),
  `updated_at` DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at` DATETIME NULL,
  INDEX `idx_job_payment_job` (`job_id`, `paid_at`),
  CONSTRAINT `fk_job_payment_job` FOREIGN KEY (`job_id`) REFERENCES `job`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
