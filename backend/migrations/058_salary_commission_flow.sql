-- 058_salary_commission_flow.sql
-- Luồng hoa hồng & lương tháng thuyền viên

-- 1. commission_rate: Partner → Job → Deployment → Salary
ALTER TABLE `partner`
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NULL COMMENT '% hoa hồng mặc định';

ALTER TABLE `job`
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NULL COMMENT '% hoa hồng (kế thừa từ partner)';

ALTER TABLE `seafarer_deployment`
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NULL COMMENT '% hoa hồng (kế thừa từ job)';

-- 2. Lương tháng thuyền viên
CREATE TABLE IF NOT EXISTS `seafarer_salary` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `deployment_id`     INT           NOT NULL,
  `salary_month`      DATE          NOT NULL COMMENT 'Ngày đầu tháng: 2025-05-01',

  -- Lương gộp (tiền trên HĐ)
  `salary_gross`      DECIMAL(15,2) NULL,

  -- Hoa hồng (kế thừa từ deployment, override được per-month)
  `commission_rate`   DECIMAL(5,2)  NULL,
  `commission_amount` DECIMAL(15,2) NULL COMMENT 'Tự tính: gross × rate/100',

  -- Khoản TV phải chịu
  `air_ticket`        DECIMAL(15,2) NULL,
  `air_ticket_name`   VARCHAR(255)  NULL COMMENT 'Tên trên vé máy bay',
  `doc_fee`           DECIMAL(15,2) NULL COMMENT 'Tiền làm CC',
  `signoff_fee`       DECIMAL(15,2) NULL COMMENT 'Phí sign-off',
  `foreign_labor_fee` DECIMAL(15,2) NULL COMMENT 'Phí LD nước ngoài',
  `export_cost`       DECIMAL(15,2) NULL COMMENT 'Chi phí xuất khẩu',
  `other_cost`        DECIMAL(15,2) NULL COMMENT 'Chi phí ngoài',
  `other_cost_note`   VARCHAR(500)  NULL,

  -- Kết quả (USD)
  `total_deductions`  DECIMAL(15,2) NULL COMMENT 'Tổng khấu trừ TV',
  `salary_net`        DECIMAL(15,2) NULL COMMENT 'Thực nhận = gross - total_deductions',

  -- Tỷ giá & VND
  `exchange_rate`     DECIMAL(15,4) NULL COMMENT '1 USD = X VND',
  `salary_net_vnd`    DECIMAL(20,2) NULL COMMENT 'salary_net × exchange_rate',

  -- Trạng thái
  `is_paid`           TINYINT(1)    NOT NULL DEFAULT 0,
  `paid_at`           DATETIME      NULL,
  `notes`             TEXT          NULL,

  `created_at`        DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`        DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`        DATETIME      NULL,

  UNIQUE KEY `uq_deployment_month` (`deployment_id`, `salary_month`),
  INDEX `idx_salary_month` (`salary_month`),
  CONSTRAINT `fk_salary_deployment`
    FOREIGN KEY (`deployment_id`) REFERENCES `seafarer_deployment`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Tỷ giá hàng loạt theo tháng
CREATE TABLE IF NOT EXISTS `monthly_exchange_rate` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `rate_month`    DATE          NOT NULL COMMENT 'Ngày đầu tháng: 2025-05-01',
  `from_currency` VARCHAR(10)   NOT NULL DEFAULT 'USD',
  `to_currency`   VARCHAR(10)   NOT NULL DEFAULT 'VND',
  `rate`          DECIMAL(15,4) NOT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`    DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_rate_month_pair` (`rate_month`, `from_currency`, `to_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
