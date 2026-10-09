-- MCAH-only marker. Target name/instance are validated by runner before SQL.
CREATE TABLE mcah_instance (
  id TINYINT PRIMARY KEY,
  product VARCHAR(20) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_mcah_product CHECK (product = 'MCAH')
) ENGINE=InnoDB;
INSERT INTO mcah_instance (id, product) VALUES (1, 'MCAH');
