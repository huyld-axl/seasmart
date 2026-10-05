-- Notification table for expiry reminders and enrollment results
CREATE TABLE IF NOT EXISTS notification (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT          NOT NULL,
  type       VARCHAR(50)  NOT NULL,
  ref_table  VARCHAR(50)  NULL,
  ref_id     INT          NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT         NULL,
  is_read    TINYINT(1)   NOT NULL DEFAULT 0,
  read_at    DATETIME     NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES `user`(id)
);
CREATE INDEX idx_notif_user_read ON notification (user_id, is_read);
