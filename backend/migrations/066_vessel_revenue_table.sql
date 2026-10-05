CREATE TABLE IF NOT EXISTS `vessel_revenue` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `salary_id`             INT           NOT NULL COMMENT 'Map 1-1 với seafarer_salary',
  `deployment_id`         INT           NOT NULL,
  `revenue_month`         DATE          NOT NULL,
  `contract_amount`       DECIMAL(15,2) NULL COMMENT 'Doanh thu USD',
  `revenue_exchange_rate` DECIMAL(15,4) NULL COMMENT 'Tỷ giá doanh thu',
  `visa_fee`              DECIMAL(15,2) NULL,
  `owner_bonus`           DECIMAL(15,2) NULL COMMENT 'Thưởng từ chủ tàu',
  `export_labor_fee`      DECIMAL(15,2) NULL COMMENT 'Phí xuất khẩu lao động',
  `immigration_fee`       DECIMAL(15,2) NULL COMMENT 'Phí cục XNC',
  `transport_fee`         DECIMAL(15,2) NULL COMMENT 'Phí xe đưa đón',
  `penalty_amount`        DECIMAL(15,2) NULL COMMENT 'Phí phạt HĐ',
  `is_paid`               TINYINT(1)    NOT NULL DEFAULT 0,
  `notes`                 TEXT          NULL,
  `created_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`            DATETIME      NULL,
  UNIQUE KEY `uq_salary_id` (`salary_id`),
  FOREIGN KEY (`salary_id`) REFERENCES `seafarer_salary`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`deployment_id`) REFERENCES `seafarer_deployment`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migrate dữ liệu hiện có từ seafarer_salary
INSERT INTO `vessel_revenue`
  (salary_id, deployment_id, revenue_month, contract_amount, revenue_exchange_rate,
   visa_fee, owner_bonus, export_labor_fee, immigration_fee, transport_fee,
   penalty_amount, is_paid, notes, created_at)
SELECT
  ss.id, ss.deployment_id, ss.salary_month,
  ss.contract_amount, ss.revenue_exchange_rate,
  ss.visa_fee, ss.owner_bonus, ss.export_labor_fee, ss.immigration_fee, ss.transport_fee,
  ss.penalty_amount, ss.is_paid, ss.notes, ss.created_at
FROM `seafarer_salary` ss
WHERE ss.deleted_at IS NULL
ON DUPLICATE KEY UPDATE salary_id = salary_id;
