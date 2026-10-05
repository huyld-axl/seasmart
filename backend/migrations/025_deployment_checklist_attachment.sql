-- 025_deployment_checklist_attachment.sql
-- Attachment per deployment checklist item (max 1 file/item)

CREATE TABLE deployment_checklist_attachment (
  id INT AUTO_INCREMENT PRIMARY KEY,
  checklist_id INT NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  file_size INT NOT NULL,
  uploaded_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_dca_checklist FOREIGN KEY (checklist_id) REFERENCES deployment_checklist(id) ON DELETE CASCADE,
  CONSTRAINT fk_dca_uploaded_by FOREIGN KEY (uploaded_by) REFERENCES user(id) ON DELETE SET NULL,
  UNIQUE KEY uq_dca_checklist (checklist_id)
);

