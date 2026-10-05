-- Bảng ghi nhận lịch sử cuộc gọi cho thuyền viên
CREATE TABLE IF NOT EXISTS seafarer_call_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seafarer_id INT NOT NULL,
  called_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note VARCHAR(500) NULL,
  called_by INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seafarer_id) REFERENCES seafarer(id),
  FOREIGN KEY (called_by) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_call_log_seafarer ON seafarer_call_log(seafarer_id, called_at DESC);
