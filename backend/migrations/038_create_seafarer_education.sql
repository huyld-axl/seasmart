-- TASK E2: Hỗ trợ nhiều trường tốt nghiệp cho 1 thuyền viên

CREATE TABLE IF NOT EXISTS seafarer_education (
  id BIGINT NOT NULL AUTO_INCREMENT,
  seafarer_id BIGINT NOT NULL,
  graduation_level VARCHAR(50) NULL,
  school_name VARCHAR(255) NOT NULL,
  graduation_year SMALLINT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  created_by BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_seafarer_education_seafarer_id (seafarer_id),
  KEY idx_seafarer_education_deleted_at (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
