-- ============================================================
-- TASK-A1: Thêm cột status, approved_by, approved_at, reject_reason, referred_by_center_id vào training_enrollment
-- Chạy: mysql -u root marineport < backend/migrations/014_enrollment_status_a1.sql
-- ============================================================
SET NAMES utf8mb4;

-- Thêm cột status (PENDING|APPROVED|ACTIVE|COMPLETED|FAILED|WITHDRAWN|REJECTED)
ALTER TABLE training_enrollment
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    COMMENT 'PENDING|APPROVED|ACTIVE|COMPLETED|FAILED|WITHDRAWN|REJECTED',
  ADD COLUMN approved_by INT NULL,
  ADD COLUMN approved_at DATETIME NULL,
  ADD COLUMN reject_reason VARCHAR(500) NULL,
  ADD COLUMN referred_by_center_id INT NULL;

ALTER TABLE training_enrollment
  ADD CONSTRAINT fk_enrollment_approved_by FOREIGN KEY (approved_by) REFERENCES `user`(id) ON DELETE SET NULL;

ALTER TABLE training_enrollment
  ADD CONSTRAINT fk_enrollment_referred_center FOREIGN KEY (referred_by_center_id) REFERENCES training_center(id) ON DELETE SET NULL;

-- Đảm bảo dữ liệu cũ giữ status ACTIVE (default đã set ở trên)
UPDATE training_enrollment SET status = 'ACTIVE' WHERE status IS NULL OR status = '';

CREATE INDEX idx_enrollment_status ON training_enrollment(status);
