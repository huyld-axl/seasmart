-- Migration 022: Lịch sử đi tàu của thuyền viên (một dòng = một chuyến), từ trang bố trí chức danh của sổ hoặc nhập tay.
-- Không dùng employment_contract: bảng đó là hợp đồng và lương.
-- Chạy: mysql -u root marineport < migrations/022_sea_service.sql
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `sea_service` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`         INT          NOT NULL,
  `document_id`         INT          NULL COMMENT 'Giấy nguồn; UNIQUE để đưa vào hồ sơ hai lần không tạo trùng. NULL khi nhập tay',
  `source_type`         VARCHAR(10)  NOT NULL DEFAULT 'MANUAL' COMMENT 'DOCUMENT | MANUAL',
  `vessel_name_raw`     VARCHAR(150) NULL,
  `vessel_type_raw`     VARCHAR(100) NULL,
  `flag_raw`            VARCHAR(100) NULL,
  `gross_tonnage_raw`   VARCHAR(50)  NULL,
  `engine_power_raw`    VARCHAR(50)  NULL,
  `owner_raw`           VARCHAR(200) NULL,
  `vessel_id`           INT          NULL COMMENT 'NULL khi chưa đối chiếu với bảng vessel',
  `vessel_match_status` VARCHAR(20)  NOT NULL DEFAULT 'NOT_CHECKED' COMMENT 'NOT_CHECKED | MATCHED | NOT_FOUND',
  `rank_raw`            VARCHAR(100) NULL,
  `rank_id`             INT          NULL COMMENT 'NULL nếu chức danh không có trong bảng rank',
  `coc_number`          VARCHAR(100) NULL,
  `sign_on_date`        DATE         NULL,
  `sign_on_port`        VARCHAR(150) NULL,
  `sign_off_date`       DATE         NULL COMMENT 'NULL khi sổ để trống (chuyến chưa kết thúc)',
  `sign_off_port`       VARCHAR(150) NULL,
  `notes`               TEXT         NULL,
  `created_by`          INT          NULL,
  `updated_by`          INT          NULL,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`          DATETIME     NULL,
  UNIQUE KEY `uq_sea_service_document` (`document_id`),
  INDEX `idx_sea_service_seafarer` (`seafarer_id`, `deleted_at`, `sign_on_date`),
  CONSTRAINT `fk_sea_service_seafarer` FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`),
  CONSTRAINT `fk_sea_service_document` FOREIGN KEY (`document_id`) REFERENCES `seafarer_document`(`id`),
  CONSTRAINT `fk_sea_service_vessel`   FOREIGN KEY (`vessel_id`)   REFERENCES `vessel`(`id`),
  CONSTRAINT `fk_sea_service_rank`     FOREIGN KEY (`rank_id`)     REFERENCES `rank`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
