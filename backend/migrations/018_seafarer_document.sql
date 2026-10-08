-- Giấy tờ tải lên để AI đọc (A3 Duyệt giấy tờ) và từng ô AI đọc ra.
CREATE TABLE IF NOT EXISTS seafarer_document (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seafarer_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  file_size INT NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  doc_type VARCHAR(40) NULL,
  page_label VARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'READING',
  error VARCHAR(500) NULL,
  published_at DATETIME NULL,
  published_by INT NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_doc_seafarer (seafarer_id, deleted_at),
  CONSTRAINT fk_doc_seafarer FOREIGN KEY (seafarer_id) REFERENCES seafarer(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_field (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  field_key VARCHAR(40) NOT NULL,
  raw_text VARCHAR(500) NULL,
  ai_value VARCHAR(500) NULL,
  ai_state VARCHAR(20) NOT NULL,
  value VARCHAR(500) NULL,
  state VARCHAR(20) NOT NULL,
  note VARCHAR(500) NULL,
  decided_by INT NULL,
  decided_at DATETIME NULL,
  UNIQUE KEY uq_doc_field (document_id, field_key),
  CONSTRAINT fk_field_doc FOREIGN KEY (document_id) REFERENCES seafarer_document(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
