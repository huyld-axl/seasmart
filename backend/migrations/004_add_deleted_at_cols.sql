-- Migration 004: Thêm cột deleted_at, created_by, updated_by còn thiếu
-- Chạy: mysql -u root marineport < migrations/004_add_deleted_at_cols.sql

ALTER TABLE training_center
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL DEFAULT NULL;

ALTER TABLE training_course
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL DEFAULT NULL;

ALTER TABLE training_enrollment
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL DEFAULT NULL;

ALTER TABLE seafarer_certificate
  ADD COLUMN IF NOT EXISTS deleted_at DATETIME NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS created_by INT NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS updated_by INT NULL DEFAULT NULL;

-- Index để tăng tốc soft delete queries
ALTER TABLE training_center     ADD INDEX IF NOT EXISTS idx_deleted_at (deleted_at);
ALTER TABLE training_course     ADD INDEX IF NOT EXISTS idx_deleted_at (deleted_at);
ALTER TABLE training_enrollment ADD INDEX IF NOT EXISTS idx_deleted_at (deleted_at);
ALTER TABLE seafarer_certificate ADD INDEX IF NOT EXISTS idx_deleted_at (deleted_at);
