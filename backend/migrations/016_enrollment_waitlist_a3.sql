-- ============================================================
-- TASK-A3: Bảng enrollment_waitlist — danh sách chờ khi khóa học đã đầy
-- Chạy: mysql -u root marineport < backend/migrations/016_enrollment_waitlist_a3.sql
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS enrollment_waitlist (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  course_id     INT NOT NULL,
  seafarer_id   INT NOT NULL,
  position      INT NOT NULL COMMENT 'Thứ tự trong hàng đợi, tính từ 1',
  requested_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notified_at   DATETIME NULL COMMENT 'Thời điểm gửi thông báo có chỗ trống',
  confirm_by    DATETIME NULL COMMENT 'Deadline xác nhận sau khi được notify (notified_at + 24h)',
  status        VARCHAR(20) NOT NULL DEFAULT 'WAITING'
                COMMENT 'WAITING|NOTIFIED|ENROLLED|EXPIRED|CANCELLED',
  notes         VARCHAR(500) NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_waitlist_course
    FOREIGN KEY (course_id) REFERENCES training_course(id) ON DELETE CASCADE,
  CONSTRAINT fk_waitlist_seafarer
    FOREIGN KEY (seafarer_id) REFERENCES seafarer(id) ON DELETE CASCADE,
  UNIQUE KEY uq_waitlist_course_seafarer (course_id, seafarer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_waitlist_course_status ON enrollment_waitlist(course_id, status);
CREATE INDEX idx_waitlist_seafarer ON enrollment_waitlist(seafarer_id);

SET FOREIGN_KEY_CHECKS = 1;
