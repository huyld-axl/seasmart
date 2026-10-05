-- ============================================================
-- Messaging tables (Task 1.1) + QR Enrollment link (Task 1.2)
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `conversation` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `title`      VARCHAR(200) NULL,
  `type`       VARCHAR(20)  NOT NULL DEFAULT 'DIRECT' COMMENT 'DIRECT|GROUP',
  `created_at` DATETIME     NOT NULL DEFAULT NOW(),
  `updated_at` DATETIME     NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `conversation_participant` (
  `id`              INT      AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT      NOT NULL,
  `user_id`         INT      NOT NULL,
  `joined_at`       DATETIME NOT NULL DEFAULT NOW(),
  `last_read_at`    DATETIME NULL,
  UNIQUE KEY `uq_conv_user` (`conversation_id`, `user_id`),
  FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`)         REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `message` (
  `id`              INT      AUTO_INCREMENT PRIMARY KEY,
  `conversation_id` INT      NOT NULL,
  `sender_id`       INT      NOT NULL,
  `content`         TEXT     NOT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT NOW(),
  `deleted_at`      DATETIME NULL,
  FOREIGN KEY (`conversation_id`) REFERENCES `conversation`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`sender_id`)       REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX IF NOT EXISTS idx_message_conv ON `message` (`conversation_id`, `created_at`);

-- QR enrollment link table removed (training/course enrollment disabled)

SET FOREIGN_KEY_CHECKS = 1;
