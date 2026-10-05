-- Thêm các cột còn thiếu vào bảng seafarer
-- Chạy sau migration.sql ban đầu

ALTER TABLE seafarer
  -- Cột cá nhân
  ADD COLUMN passport_issued_date     DATE           NULL AFTER passport_number,
  ADD COLUMN national_id_issued_date  DATE           NULL AFTER national_id,
  ADD COLUMN national_id_issued_place VARCHAR(150)   NULL AFTER national_id_issued_date,
  ADD COLUMN social_insurance_joined  TINYINT(1)     NULL AFTER social_insurance_number,
  ADD COLUMN bank_account_holder      VARCHAR(150)   NULL AFTER bank_account_number,
  ADD COLUMN marital_status           VARCHAR(30)    NULL AFTER gender,
  ADD COLUMN children_count           TINYINT        NULL AFTER marital_status,
  ADD COLUMN children_info            TEXT           NULL AFTER children_count,
  ADD COLUMN children_ages            VARCHAR(100)   NULL AFTER children_info,
  ADD COLUMN shirt_size               VARCHAR(10)    NULL AFTER weight_kg,
  ADD COLUMN pants_size               VARCHAR(10)    NULL AFTER shirt_size,
  -- Raw columns từ Excel (resolve sang bảng khác sau)
  ADD COLUMN vessel_group             VARCHAR(20)    NULL COMMENT 'KHỐI: SEC, FEI, ASL...',
  ADD COLUMN vessel_name_raw          VARCHAR(150)   NULL COMMENT 'Tên tàu raw, resolve sau',
  ADD COLUMN contract_flight_date     DATE           NULL COMMENT 'Ngày bay',
  ADD COLUMN contract_start_date      DATE           NULL COMMENT 'Ngày nhập tàu',
  ADD COLUMN contract_duration_raw    VARCHAR(30)    NULL COMMENT 'Thời gian HĐ, vd "10±2"',
  ADD COLUMN contract_salary_raw      DECIMAL(10,2)  NULL COMMENT 'Lương HĐ USD',
  ADD COLUMN contract_end_date        DATE           NULL COMMENT 'Ngày rời tàu',
  ADD COLUMN contract_return_date     DATE           NULL COMMENT 'Ngày về VN',
  ADD COLUMN rank_name_vi             VARCHAR(100)   NULL COMMENT 'Tên chức danh tiếng Việt từ Excel (cột 44)';
