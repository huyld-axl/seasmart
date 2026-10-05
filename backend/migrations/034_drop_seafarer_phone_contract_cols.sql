-- 034_drop_seafarer_phone_contract_cols.sql
-- Drop cac cot khong con su dung tren ho so seafarer

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'phone_secondary'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN phone_secondary', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'contract_flight_date'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN contract_flight_date', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'contract_start_date'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN contract_start_date', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'contract_end_date'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN contract_end_date', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'contract_return_date'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN contract_return_date', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'contract_duration_raw'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN contract_duration_raw', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_col = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'seafarer' AND column_name = 'contract_salary_raw'
);
SET @sql_text = IF(@has_col > 0, 'ALTER TABLE seafarer DROP COLUMN contract_salary_raw', 'SELECT 1');
PREPARE stmt FROM @sql_text; EXECUTE stmt; DEALLOCATE PREPARE stmt;
