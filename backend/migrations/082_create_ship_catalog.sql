CREATE TABLE IF NOT EXISTS ship_catalog (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  imo_no VARCHAR(10),
  ship_name VARCHAR(255) NOT NULL,
  ex_names TEXT,
  mmsi VARCHAR(20),
  ship_type VARCHAR(100),
  country_name VARCHAR(100),
  INDEX idx_ship_name (ship_name(50)),
  INDEX idx_imo_no (imo_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
