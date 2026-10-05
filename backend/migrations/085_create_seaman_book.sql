CREATE TABLE IF NOT EXISTS `seaman_book` (
  `id`           INT           NOT NULL AUTO_INCREMENT,
  `seafarer_id`  INT           NOT NULL,
  `book_number`  VARCHAR(50)   NOT NULL,
  `issued_date`  DATE          NULL,
  `expiry_date`  DATE          NULL,
  `issued_place` VARCHAR(255)  NULL,
  `notes`        TEXT          NULL,
  `created_at`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME      NULL,
  PRIMARY KEY (`id`),
  KEY `idx_seaman_book_seafarer` (`seafarer_id`),
  CONSTRAINT `fk_seaman_book_seafarer` FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
