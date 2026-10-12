-- Migration 024: Nhật ký mỗi lần gọi AI (token, thời gian, mã yêu cầu). Không chứa nội dung giấy tờ.
-- Chạy: mysql -u root marineport < migrations/024_ai_call.sql
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `ai_call` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `upload_id`      INT NULL,
  `document_id`    INT NULL,
  `task`           VARCHAR(20)  NOT NULL COMMENT 'split | certificate | book_info | book_duty | read',
  `provider`       VARCHAR(20)  NOT NULL,
  `model`          VARCHAR(100) NULL,
  `prompt_version` VARCHAR(20)  NULL,
  `input_tokens`   INT NULL,
  `output_tokens`  INT NULL,
  `latency_ms`     INT NULL,
  `request_id`     VARCHAR(100) NULL,
  `status`         VARCHAR(10)  NOT NULL COMMENT 'OK | ERROR',
  `error`          VARCHAR(500) NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ai_call_upload (`upload_id`),
  INDEX idx_ai_call_document (`document_id`),
  INDEX idx_ai_call_created (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
