-- ============================================================
-- Crew Manning - MySQL / MariaDB Migration Script
-- Schema hoàn chỉnh (final state, all-in-one)
-- Chạy trên DB trắng: mysql -u root -p marineport_db < migration.sql
-- ============================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. country ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `country` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `code`       CHAR(2)       NOT NULL UNIQUE COMMENT 'ISO 3166-1 alpha-2',
  `name_en`    VARCHAR(100)  NOT NULL,
  `name_vi`    VARCHAR(100)  NULL,
  `created_at` DATETIME      NOT NULL DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. port ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `port` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `un_locode`   CHAR(5)       NULL UNIQUE,
  `name`        VARCHAR(150)  NOT NULL,
  `country_id`  INT           NOT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`country_id`) REFERENCES `country`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. rank ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `rank` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `code`        VARCHAR(20)   NOT NULL UNIQUE,
  `name_vi`     VARCHAR(100)  NOT NULL,
  `name_en`     VARCHAR(100)  NOT NULL,
  `department`  VARCHAR(50)   NULL COMMENT 'DECK / ENGINE / CATERING',
  `rank_level`  SMALLINT      NULL COMMENT '1=Sĩ quan, 2=Thủy thủ, 3=Phục vụ',
  `created_at`  DATETIME      NOT NULL DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. vessel_type ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `vessel_type` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `code`        VARCHAR(30)   NOT NULL UNIQUE,
  `name_vi`     VARCHAR(100)  NOT NULL,
  `name_en`     VARCHAR(100)  NOT NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. certificate_type ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `certificate_type` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `code`                VARCHAR(50)   NOT NULL UNIQUE,
  `name_vi`             VARCHAR(200)  NOT NULL,
  `name_en`             VARCHAR(200)  NOT NULL,
  `issuing_authority`   VARCHAR(200)  NULL,
  `validity_years`      SMALLINT      NULL COMMENT 'NULL = vĩnh viễn',
  `is_stcw`             TINYINT(1)    NOT NULL DEFAULT 1,
  `category`            ENUM('STCW','VN','DOCUMENT','MEDICAL','PANAMA','OTHER') NOT NULL DEFAULT 'OTHER',
  `abbreviation`        VARCHAR(30)   NULL,
  `required_for_ranks`  JSON          NULL COMMENT 'Mảng rank.id',
  `created_at`          DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`          DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. contract_type ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `contract_type` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `code`        VARCHAR(30)   NOT NULL UNIQUE,
  `name_vi`     VARCHAR(100)  NOT NULL,
  `name_en`     VARCHAR(100)  NULL,
  `created_at`  DATETIME      NOT NULL DEFAULT NOW()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. course_type ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `course_type` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `code`                VARCHAR(50)   NOT NULL UNIQUE,
  `name_vi`             VARCHAR(150)  NOT NULL,
  `name_en`             VARCHAR(150)  NULL,
  `certificate_type_id` INT           NULL,
  `duration_days`       SMALLINT      NULL,
  `created_at`          DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`certificate_type_id`) REFERENCES `certificate_type`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 8. user ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `user` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `email`                 VARCHAR(150)  NOT NULL UNIQUE,
  `password_hash`         VARCHAR(255)  NOT NULL,
  `role`                  VARCHAR(30)   NOT NULL COMMENT 'admin|operator|accountant|seafarer',
  `verification_status`   VARCHAR(20)   NOT NULL DEFAULT 'unverified',
  `linked_entity_type`    VARCHAR(30)   NULL,
  `linked_entity_id`      INT           NULL,
  `is_active`             TINYINT(1)    NOT NULL DEFAULT 1,
  `verified_at`           DATETIME      NULL,
  `last_login_at`         DATETIME      NULL,
  `created_at`            DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`            DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`            DATETIME      NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 9. otp_verification ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `otp_verification` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`       INT           NOT NULL,
  `phone`         VARCHAR(20)   NOT NULL,
  `otp_code_hash` VARCHAR(255)  NOT NULL,
  `purpose`       VARCHAR(30)   NOT NULL DEFAULT 'identity_verify',
  `expires_at`    DATETIME      NOT NULL,
  `used_at`       DATETIME      NULL,
  `attempt_count` TINYINT       NOT NULL DEFAULT 0,
  `created_at`    DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 10. seafarer ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer` (
  `id`                      INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_code`           VARCHAR(30)   NULL,
  `national_id`             VARCHAR(20)   NULL,
  `passport_number`         VARCHAR(20)   NULL,
  `passport_expiry`         DATE          NULL,
  `seaman_book_number`      VARCHAR(30)   NULL,
  `seaman_book_expiry`      DATE          NULL,
  `vietnam_registry_id`     VARCHAR(30)   NULL,
  `full_name`               VARCHAR(150)  NOT NULL,
  `full_name_en`            VARCHAR(150)  NULL,
  `date_of_birth`           DATE          NOT NULL,
  `place_of_birth`          VARCHAR(200)  NULL,
  `gender`                  CHAR(1)       NOT NULL DEFAULT 'M',
  `nationality_id`          INT           NOT NULL,
  `ethnicity`               VARCHAR(50)   NULL,
  `religion`                VARCHAR(50)   NULL,
  `permanent_address`       TEXT          NULL,
  `permanent_ward`          VARCHAR(100)  NULL,
  `permanent_district`      VARCHAR(100)  NULL,
  `permanent_province`      VARCHAR(100)  NULL,
  `contact_address`         TEXT          NULL,
  `phone_primary`           VARCHAR(20)   NULL,
  `phone_secondary`         VARCHAR(20)   NULL,
  `email`                   VARCHAR(150)  NULL,
  `height_cm`               SMALLINT      NULL,
  `weight_kg`               SMALLINT      NULL,
  `blood_type`              VARCHAR(5)    NULL,
  `medical_cert_number`     VARCHAR(50)   NULL,
  `medical_cert_expiry`     DATE          NULL,
  `education_level`         VARCHAR(50)   NULL,
  `education_major`         VARCHAR(150)  NULL,
  `education_school`        VARCHAR(200)  NULL,
  `english_level`           VARCHAR(50)   NULL,
  `english_score`           SMALLINT      NULL,
  `current_rank_id`         INT           NULL,
  `bank_account_number`     VARCHAR(30)   NULL,
  `bank_name`               VARCHAR(100)  NULL,
  `bank_branch`             VARCHAR(150)  NULL,
  `social_insurance_number` VARCHAR(20)   NULL,
  `social_insurance_date`   DATE          NULL,
  `status`                  VARCHAR(30)   NOT NULL DEFAULT 'AVAILABLE' COMMENT 'AVAILABLE|ON_VESSEL|ON_LEAVE|TRAINING|BLACKLISTED|RETIRED|INACTIVE',
  `notes`                   TEXT          NULL,
  `user_id`                 INT           NULL,
  `created_by`              INT           NULL,
  `updated_by`              INT           NULL,
  `created_at`              DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`              DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`              DATETIME      NULL,
  FOREIGN KEY (`nationality_id`)  REFERENCES `country`(`id`),
  FOREIGN KEY (`current_rank_id`) REFERENCES `rank`(`id`),
  FOREIGN KEY (`user_id`)         REFERENCES `user`(`id`),
  FOREIGN KEY (`created_by`)      REFERENCES `user`(`id`),
  FOREIGN KEY (`updated_by`)      REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 11. seafarer_contact ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer_contact` (
  `id`                        INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`               INT           NOT NULL,
  `relationship`              VARCHAR(50)   NOT NULL,
  `is_emergency_contact`      TINYINT(1)    NOT NULL DEFAULT 0,
  `is_guarantor`              TINYINT(1)    NOT NULL DEFAULT 0,
  `full_name`                 VARCHAR(150)  NOT NULL,
  `date_of_birth`             DATE          NULL,
  `national_id`               VARCHAR(20)   NULL,
  `phone_primary`             VARCHAR(20)   NULL,
  `phone_secondary`           VARCHAR(20)   NULL,
  `email`                     VARCHAR(150)  NULL,
  `address`                   TEXT          NULL,
  `ward`                      VARCHAR(100)  NULL,
  `district`                  VARCHAR(100)  NULL,
  `province`                  VARCHAR(100)  NULL,
  `occupation`                VARCHAR(150)  NULL,
  `workplace`                 VARCHAR(200)  NULL,
  `guarantor_id_number`       VARCHAR(20)   NULL,
  `guarantor_id_issued_date`  DATE          NULL,
  `guarantor_id_issued_place` VARCHAR(150)  NULL,
  `created_at`                DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`                DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 12. seafarer_rank_history ────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer_rank_history` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`    INT           NOT NULL,
  `rank_id`        INT           NOT NULL,
  `effective_date` DATE          NOT NULL,
  `end_date`       DATE          NULL,
  `notes`          TEXT          NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`),
  FOREIGN KEY (`rank_id`)     REFERENCES `rank`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 13. seafarer_certificate ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer_certificate` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`           INT           NOT NULL,
  `certificate_type_id`   INT           NOT NULL,
  `certificate_number`    VARCHAR(100)  NULL,
  `issued_date`           DATE          NOT NULL,
  `expiry_date`           DATE          NULL,
  `issued_by`             VARCHAR(200)  NULL,
  `issued_at_country_id`  INT           NULL,
  `status`                VARCHAR(20)   NOT NULL DEFAULT 'VALID' COMMENT 'VALID|EXPIRED|REVOKED|PENDING',
  `document_url`          TEXT          NULL,
  `notes`                 TEXT          NULL,
  `created_at`            DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`            DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_seafarer_cert` (`seafarer_id`, `certificate_type_id`, `issued_date`),
  FOREIGN KEY (`seafarer_id`)          REFERENCES `seafarer`(`id`),
  FOREIGN KEY (`certificate_type_id`)  REFERENCES `certificate_type`(`id`),
  FOREIGN KEY (`issued_at_country_id`) REFERENCES `country`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 14. seafarer_deployment ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer_deployment` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id`   INT           NOT NULL,
  `vessel_id`     INT           NULL,
  `vessel_name`   VARCHAR(255)  NULL,
  `rank_id`       INT           NULL,
  `status`        ENUM('collecting_docs','confirmed','pre_boarding','onboard','signed_off') NOT NULL DEFAULT 'collecting_docs',
  `join_date`     DATE          NULL,
  `sign_off_date` DATE          NULL,
  `notes`         TEXT          NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`    DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`rank_id`)     REFERENCES `rank`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 15. deployment_checklist ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `deployment_checklist` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `deployment_id` INT           NOT NULL,
  `item_key`      VARCHAR(100)  NOT NULL,
  `item_label`    VARCHAR(255)  NOT NULL,
  `is_checked`    TINYINT(1)    NOT NULL DEFAULT 0,
  `checked_at`    DATETIME      NULL,
  `notes`         VARCHAR(500)  NULL,
  `updated_at`    DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_deployment_item` (`deployment_id`, `item_key`),
  FOREIGN KEY (`deployment_id`) REFERENCES `seafarer_deployment`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 16. partner ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `partner` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `code`             VARCHAR(30)   NOT NULL UNIQUE,
  `company_name`     VARCHAR(200)  NOT NULL,
  `company_name_en`  VARCHAR(200)  NULL,
  `representative`   VARCHAR(200)  NULL,
  `country_id`       INT           NULL,
  `address`          TEXT          NULL,
  `phone`            VARCHAR(30)   NULL,
  `fax`              VARCHAR(30)   NULL,
  `email`            VARCHAR(150)  NULL,
  `website`          VARCHAR(200)  NULL,
  `contact_person`   VARCHAR(150)  NULL,
  `contact_phone`    VARCHAR(30)   NULL,
  `contact_email`    VARCHAR(150)  NULL,
  `tax_id`           VARCHAR(50)   NULL,
  `payment_cycle`    VARCHAR(50)   NULL,
  `payment_terms`    TEXT          NULL,
  `is_active`        TINYINT(1)    NOT NULL DEFAULT 1,
  `notes`            TEXT          NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`       DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`       DATETIME      NULL,
  FOREIGN KEY (`country_id`) REFERENCES `country`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 17. vessel ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `vessel` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `imo_number`             VARCHAR(10)   NULL UNIQUE,
  `mmsi`                   VARCHAR(10)   NULL,
  `call_sign`              VARCHAR(10)   NULL,
  `trade_area`             VARCHAR(255)  NULL,
  `vessel_name`            VARCHAR(150)  NOT NULL,
  `vessel_name_prev`       VARCHAR(150)  NULL,
  `vessel_type`            VARCHAR(255)  NULL,
  `flag_country`           VARCHAR(255)  NULL,
  `port_of_registry_id`    INT           NULL,
  `gross_tonnage`          DECIMAL(10,2) NULL,
  `net_tonnage`            DECIMAL(10,2) NULL,
  `deadweight`             DECIMAL(10,2) NULL,
  `engine_power_kw`        INT           NULL,
  `engine_type`            VARCHAR(100)  NULL,
  `dp_class`               ENUM('DPS-1','DPS-2','DPS-3') NULL,
  `has_boiler`             TINYINT(1)    NOT NULL DEFAULT 0,
  `has_refrigeration`      TINYINT(1)    NOT NULL DEFAULT 0,
  `passenger_capacity`     SMALLINT      NULL,
  `crew_capacity`          SMALLINT      NULL,
  `length_overall`         DECIMAL(8,2)  NULL,
  `year_built`             SMALLINT      NULL,
  `classification_society` VARCHAR(50)   NULL,
  `class_status`           ENUM('CLASSED','SUSPENDED','WITHDRAWN','NOT_CLASSED') NULL,
  `lifecycle_status`       ENUM('IN_SERVICE','LAID_UP','SCRAPPED','UNDER_CONSTRUCTION') NOT NULL DEFAULT 'IN_SERVICE',
  `partner_id`             INT           NULL,
  `technical_manager`      VARCHAR(200)  NULL,
  `commercial_manager`     VARCHAR(200)  NULL,
  `status`                 VARCHAR(30)   NOT NULL DEFAULT 'IN_SERVICE',
  `notes`                  TEXT          NULL,
  `created_at`             DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`             DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`             DATETIME      NULL,
  FOREIGN KEY (`port_of_registry_id`) REFERENCES `port`(`id`),
  FOREIGN KEY (`partner_id`)          REFERENCES `partner`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 18. vessel_cert_type ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `vessel_cert_type` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `code`              VARCHAR(50)   NOT NULL UNIQUE,
  `name_vi`           VARCHAR(200)  NOT NULL,
  `name_en`           VARCHAR(200)  NOT NULL,
  `issuing_authority` VARCHAR(200)  NULL,
  `validity_years`    TINYINT       NULL,
  `applies_to`        VARCHAR(500)  NULL,
  `is_imo_mandatory`  TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO `vessel_cert_type` (code, name_vi, name_en, issuing_authority, validity_years, applies_to, is_imo_mandatory) VALUES
  ('SMC',     'Giấy chứng nhận quản lý an toàn',        'Safety Management Certificate',               'Flag State',    5,    'All ISM vessels',              1),
  ('IOPP',    'Giấy chứng nhận ngăn ngừa ô nhiễm dầu',  'Int''l Oil Pollution Prevention Certificate', 'Flag State',    5,    'Ships ≥ 400GT',                1),
  ('LL',      'Giấy chứng nhận mạn khô',                'Load Line Certificate',                       'Flag State',    5,    'All seagoing vessels',         1),
  ('CLASS',   'Giấy chứng nhận đăng kiểm',              'Class Certificate',                           'Class Society', 5,    'All classed vessels',          1),
  ('RADIO',   'Giấy phép đài tàu',                      'Radio Station License',                       'Flag State',    1,    'All vessels with radio',       1),
  ('TONNAGE', 'Giấy chứng nhận dung tích',              'International Tonnage Certificate',           'Flag State',    NULL, 'Ships ≥ 24m',                  1),
  ('PSSC',    'Giấy chứng nhận an toàn tàu khách',      'Passenger Ship Safety Certificate',           'Flag State',    1,    'Passenger ships (≥12 pax)',    1),
  ('DOC',     'Tài liệu phù hợp ISM (công ty)',         'Document of Compliance',                      'Flag State',    5,    'ISM company certificate',      1),
  ('ISSC',    'Giấy chứng nhận an ninh tàu',            'International Ship Security Certificate',     'Flag State',    5,    'Ships subject to ISPS Code',   1),
  ('MLC',     'Giấy chứng nhận lao động hàng hải',      'Maritime Labour Certificate',                 'Flag State',    5,    'Ships ≥ 500GT, international', 1),
  ('P_I',     'Bảo hiểm trách nhiệm dân sự P&I',        'P&I Club Certificate of Entry',               'P&I Club',      1,    NULL,                           0),
  ('HULL',    'Bảo hiểm thân tàu',                      'Hull & Machinery Insurance Certificate',      'Insurer',       1,    NULL,                           0);

-- ── 19. vessel_certificate ───────────────────────────────────
CREATE TABLE IF NOT EXISTS `vessel_certificate` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `vessel_id`          INT           NOT NULL,
  `cert_type_id`       INT           NOT NULL,
  `certificate_number` VARCHAR(100)  NULL,
  `issued_date`        DATE          NULL,
  `expiry_date`        DATE          NULL,
  `issued_by`          VARCHAR(200)  NULL,
  `surveyor`           VARCHAR(200)  NULL,
  `status`             ENUM('VALID','EXPIRED','SUSPENDED','WITHDRAWN') NOT NULL DEFAULT 'VALID',
  `document_url`       VARCHAR(500)  NULL,
  `notes`              TEXT          NULL,
  `created_at`         DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`         DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`         DATETIME      NULL,
  INDEX `idx_vessel_cert` (`vessel_id`, `cert_type_id`),
  INDEX `idx_expiry`      (`expiry_date`),
  FOREIGN KEY (`vessel_id`)    REFERENCES `vessel`(`id`),
  FOREIGN KEY (`cert_type_id`) REFERENCES `vessel_cert_type`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 20. vessel_certificate_requirement ──────────────────────
CREATE TABLE IF NOT EXISTS `vessel_certificate_requirement` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `vessel_id`           INT        NOT NULL,
  `rank_id`             INT        NOT NULL,
  `certificate_type_id` INT        NOT NULL,
  `is_mandatory`        TINYINT(1) NOT NULL DEFAULT 1,
  `notes`               TEXT       NULL,
  `created_at`          DATETIME   NOT NULL DEFAULT NOW(),
  UNIQUE KEY `uq_vessel_cert_req` (`vessel_id`, `rank_id`, `certificate_type_id`),
  FOREIGN KEY (`vessel_id`)           REFERENCES `vessel`(`id`),
  FOREIGN KEY (`rank_id`)             REFERENCES `rank`(`id`),
  FOREIGN KEY (`certificate_type_id`) REFERENCES `certificate_type`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 21. job ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `job` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `partner_id`     INT           NOT NULL,
  `vessel_id`      INT           NULL,
  `rank_id`        INT           NOT NULL,
  `seafarer_id`    INT           NULL,
  `start_date`     DATE          NULL,
  `contract_date`  DATE          NULL,
  `end_date`       DATE          NULL,
  `amount`         DECIMAL(15,2) NULL,
  `currency`       VARCHAR(10)   NOT NULL DEFAULT 'VND',
  `payment_cycle`  VARCHAR(50)   NULL,
  `payment_status` ENUM('UNPAID','PAID','PARTIAL') NOT NULL DEFAULT 'UNPAID',
  `paid_at`        DATETIME      NULL,
  `paid_amount`    DECIMAL(15,2) NULL,
  `payment_notes`  TEXT          NULL,
  `notes`          TEXT          NULL,
  `status`         ENUM('OPEN','FILLED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  `created_at`     DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`     DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`     DATETIME      NULL,
  FOREIGN KEY (`partner_id`)    REFERENCES `partner`(`id`),
  FOREIGN KEY (`vessel_id`)     REFERENCES `vessel`(`id`),
  FOREIGN KEY (`rank_id`)       REFERENCES `rank`(`id`),
  FOREIGN KEY (`seafarer_id`)   REFERENCES `seafarer`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 22. manning_agent ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `manning_agent` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `code`             VARCHAR(30)    NOT NULL UNIQUE,
  `company_name`     VARCHAR(200)   NOT NULL,
  `company_name_en`  VARCHAR(200)   NULL,
  `country_id`       INT            NULL,
  `license_number`   VARCHAR(50)    NULL,
  `license_expiry`   DATE           NULL,
  `licensed_by`      VARCHAR(200)   NULL,
  `address`          TEXT           NULL,
  `phone`            VARCHAR(30)    NULL,
  `email`            VARCHAR(150)   NULL,
  `contact_person`   VARCHAR(150)   NULL,
  `contact_phone`    VARCHAR(30)    NULL,
  `service_fee_usd`  DECIMAL(10,2)  NULL,
  `is_active`        TINYINT(1)     NOT NULL DEFAULT 1,
  `notes`            TEXT           NULL,
  `created_at`       DATETIME       NOT NULL DEFAULT NOW(),
  `updated_at`       DATETIME       NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`       DATETIME       NULL,
  FOREIGN KEY (`country_id`) REFERENCES `country`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 21b. job_payment ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `job_payment` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `job_id` INT NOT NULL,
  `payment_cycle_text` VARCHAR(255) NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `paid_at` DATETIME NULL,
  `notes` TEXT NULL,
  `attachment_original_name` VARCHAR(255) NULL,
  `attachment_stored_name` VARCHAR(255) NULL,
  `attachment_path` VARCHAR(500) NULL,
  `attachment_url` VARCHAR(500) NULL,
  `attachment_mime_type` VARCHAR(100) NULL,
  `attachment_size` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT NOW(),
  `updated_at` DATETIME NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at` DATETIME NULL,
  INDEX `idx_job_payment_job` (`job_id`, `paid_at`),
  FOREIGN KEY (`job_id`) REFERENCES `job`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 13b. partner payment method/account fields ───────────────
ALTER TABLE `partner`
  ADD COLUMN `payment_method` VARCHAR(100) NULL AFTER `payment_cycle`,
  ADD COLUMN `payment_account_name` VARCHAR(255) NULL AFTER `payment_terms`,
  ADD COLUMN `payment_account_number` VARCHAR(100) NULL AFTER `payment_account_name`,
  ADD COLUMN `payment_bank_name` VARCHAR(255) NULL AFTER `payment_account_number`,
  ADD COLUMN `payment_bank_branch` VARCHAR(255) NULL AFTER `payment_bank_name`;

-- ── 23. employment_contract ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `employment_contract` (
  `id`                      INT AUTO_INCREMENT PRIMARY KEY,
  `contract_number`         VARCHAR(50)    NOT NULL,
  `seafarer_id`             INT            NOT NULL,
  `vessel_id`               INT            NOT NULL,
  `partner_id`              INT            NOT NULL,
  `manning_agent_id`        INT            NULL,
  `contract_type_id`        INT            NULL,
  `rank_id`                 INT            NOT NULL,
  `sign_date`               DATE           NOT NULL,
  `start_date`              DATE           NOT NULL,
  `end_date`                DATE           NULL,
  `actual_end_date`         DATE           NULL,
  `duration_months`         SMALLINT       NULL,
  `sign_on_port_id`         INT            NULL,
  `sign_off_port_id`        INT            NULL,
  `basic_wage_usd`          DECIMAL(10,2)  NOT NULL,
  `overtime_rate_usd`       DECIMAL(8,2)   NULL,
  `leave_pay_usd`           DECIMAL(10,2)  NULL,
  `subsistence_usd`         DECIMAL(8,2)   NULL,
  `total_monthly_usd`       DECIMAL(10,2)  NULL,
  `p_and_i_club`            VARCHAR(100)   NULL,
  `insurance_policy_number` VARCHAR(50)    NULL,
  `life_insurance_usd`      DECIMAL(10,2)  NULL,
  `agency_fee_usd`          DECIMAL(10,2)  NULL,
  `visa_fee_usd`            DECIMAL(8,2)   NULL,
  `medical_fee_usd`         DECIMAL(8,2)   NULL,
  `training_fee_usd`        DECIMAL(8,2)   NULL,
  `total_cost_usd`          DECIMAL(10,2)  NULL,
  `status`                  VARCHAR(30)    NOT NULL DEFAULT 'DRAFT' COMMENT 'DRAFT|SIGNED|ACTIVE|COMPLETED|TERMINATED|CANCELLED',
  `termination_reason`      TEXT           NULL,
  `notes`                   TEXT           NULL,
  `document_url`            TEXT           NULL,
  `created_at`              DATETIME       NOT NULL DEFAULT NOW(),
  `updated_at`              DATETIME       NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`              DATETIME       NULL,
  FOREIGN KEY (`seafarer_id`)      REFERENCES `seafarer`(`id`),
  FOREIGN KEY (`vessel_id`)        REFERENCES `vessel`(`id`),
  FOREIGN KEY (`partner_id`)       REFERENCES `partner`(`id`),
  FOREIGN KEY (`manning_agent_id`) REFERENCES `manning_agent`(`id`),
  FOREIGN KEY (`contract_type_id`) REFERENCES `contract_type`(`id`),
  FOREIGN KEY (`rank_id`)          REFERENCES `rank`(`id`),
  FOREIGN KEY (`sign_on_port_id`)  REFERENCES `port`(`id`),
  FOREIGN KEY (`sign_off_port_id`) REFERENCES `port`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 24. contract_payroll ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `contract_payroll` (
  `id`                      INT AUTO_INCREMENT PRIMARY KEY,
  `contract_id`             INT            NOT NULL,
  `pay_period_year`         SMALLINT       NOT NULL,
  `pay_period_month`        SMALLINT       NOT NULL,
  `basic_wage_usd`          DECIMAL(10,2)  NOT NULL,
  `overtime_hours`          DECIMAL(6,2)   NULL,
  `overtime_amount_usd`     DECIMAL(10,2)  NULL,
  `bonus_usd`               DECIMAL(10,2)  NULL,
  `gross_usd`               DECIMAL(10,2)  NOT NULL,
  `advance_deduction_usd`   DECIMAL(10,2)  NULL,
  `insurance_deduction_usd` DECIMAL(10,2)  NULL,
  `net_usd`                 DECIMAL(10,2)  NOT NULL,
  `payment_date`            DATE           NULL,
  `payment_method`          VARCHAR(30)    NULL COMMENT 'BANK_TRANSFER|CASH',
  `is_paid`                 TINYINT(1)     NOT NULL DEFAULT 0,
  `notes`                   TEXT           NULL,
  `created_at`              DATETIME       NOT NULL DEFAULT NOW(),
  UNIQUE KEY `uq_payroll_period` (`contract_id`, `pay_period_year`, `pay_period_month`),
  FOREIGN KEY (`contract_id`) REFERENCES `employment_contract`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 25-28. training_center / training_course / training_enrollment removed
-- The current product keeps certificate CRUD independent from training/course enrollment.

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_seafarer_name       ON `seafarer` (`full_name`);
CREATE INDEX idx_seafarer_dob        ON `seafarer` (`date_of_birth`);
CREATE INDEX idx_seafarer_status     ON `seafarer` (`status`);
CREATE INDEX idx_seafarer_rank       ON `seafarer` (`current_rank_id`);
CREATE INDEX idx_seafarer_national   ON `seafarer` (`national_id`);
CREATE INDEX idx_seafarer_seaman     ON `seafarer` (`seaman_book_number`);
CREATE INDEX idx_cert_seafarer       ON `seafarer_certificate` (`seafarer_id`);
CREATE INDEX idx_cert_expiry         ON `seafarer_certificate` (`expiry_date`, `status`);
CREATE INDEX idx_contract_seafarer   ON `employment_contract` (`seafarer_id`);
CREATE INDEX idx_contract_vessel     ON `employment_contract` (`vessel_id`);
CREATE INDEX idx_contract_status     ON `employment_contract` (`status`);
CREATE INDEX idx_otp_user            ON `otp_verification` (`user_id`, `expires_at`);
CREATE INDEX idx_job_owner           ON `job` (`partner_id`, `deleted_at`);
CREATE INDEX idx_job_status          ON `job` (`status`, `payment_status`);
CREATE INDEX idx_deployment_seafarer ON `seafarer_deployment` (`seafarer_id`);
CREATE INDEX idx_deployment_vessel   ON `seafarer_deployment` (`vessel_id`);

SET FOREIGN_KEY_CHECKS = 1;

-- ── Patch: thêm cột theo dõi thời hạn vào loại chứng chỉ ─────────────────────
ALTER TABLE `certificate_type`
  ADD COLUMN IF NOT EXISTS `warning_before_months` SMALLINT NULL DEFAULT NULL
    COMMENT 'Số tháng trước hạn cần theo dõi/cảnh báo cho loại chứng chỉ này. NULL = mặc định 1 tháng';

-- ── Patch: thêm cột lương vào seafarer_deployment ─────────────────────────────
ALTER TABLE `seafarer_deployment`
  ADD COLUMN IF NOT EXISTS `salary`          DECIMAL(15,2) NULL COMMENT 'Lương thỏa thuận',
  ADD COLUMN IF NOT EXISTS `salary_actual`   DECIMAL(15,2) NULL COMMENT 'Thực nhận',
  ADD COLUMN IF NOT EXISTS `salary_currency` VARCHAR(10)   NULL DEFAULT 'USD';

-- ── Patch: thêm cột ngày HĐ vào seafarer_deployment ──────────────────────────
ALTER TABLE `seafarer_deployment`
  ADD COLUMN IF NOT EXISTS `contract_start_date` DATE NULL COMMENT 'Ngày bắt đầu hợp đồng',
  ADD COLUMN IF NOT EXISTS `contract_end_date`   DATE NULL COMMENT 'Ngày kết thúc hợp đồng';

-- ── seafarer_call_log ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer_call_log` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_id` INT NOT NULL,
  `called_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `note`        VARCHAR(500) NULL,
  `called_by`   INT NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`seafarer_id`) REFERENCES `seafarer`(`id`),
  FOREIGN KEY (`called_by`) REFERENCES `user`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX `idx_call_log_seafarer` ON `seafarer_call_log`(`seafarer_id`, `called_at` DESC);

-- ── Patch: partner.representative ─────────────────────────────────────────────
ALTER TABLE `partner`
  ADD COLUMN IF NOT EXISTS `representative` VARCHAR(150) NULL COMMENT 'Người đại diện' AFTER `company_name_en`;

-- ── Patch: commission_rate (partner → job → deployment) ──────────────────────
ALTER TABLE `partner`
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NULL COMMENT '% hoa hồng mặc định';

ALTER TABLE `job`
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NULL COMMENT '% hoa hồng (kế thừa từ partner)';

ALTER TABLE `seafarer_deployment`
  ADD COLUMN IF NOT EXISTS `commission_rate` DECIMAL(5,2) NULL COMMENT '% hoa hồng (kế thừa từ job)';

-- ── seafarer_salary — lương tháng thuyền viên ────────────────────────────────
CREATE TABLE IF NOT EXISTS `seafarer_salary` (
  `id`                INT AUTO_INCREMENT PRIMARY KEY,
  `deployment_id`     INT           NOT NULL,
  `salary_month`      DATE          NOT NULL COMMENT 'YYYY-MM-01',
  `salary_gross`      DECIMAL(15,2) NULL,
  `contract_amount`   DECIMAL(15,2) NULL COMMENT 'Lương HĐ (override từ job.amount)',
  `working_days`      TINYINT UNSIGNED NULL COMMENT 'Số ngày làm việc trong tháng',
  `commission_rate`   DECIMAL(5,2)  NULL,
  `commission_amount` DECIMAL(15,2) NULL,
  `air_ticket`        DECIMAL(15,2) NULL,
  `air_ticket_name`   VARCHAR(255)  NULL,
  `doc_fee`           DECIMAL(15,2) NULL,
  `signoff_fee`       DECIMAL(15,2) NULL,
  `foreign_labor_fee` DECIMAL(15,2) NULL,
  `export_cost`       DECIMAL(15,2) NULL,
  `other_cost`        DECIMAL(15,2) NULL,
  `other_cost_note`   VARCHAR(500)  NULL,
  `total_deductions`  DECIMAL(15,2) NULL,
  `advance_payment`   DECIMAL(15,2) NULL COMMENT 'Tạm ứng',
  `salary_net`        DECIMAL(15,2) NULL,
  `exchange_rate`     DECIMAL(15,4) NULL,
  `salary_net_vnd`    DECIMAL(20,2) NULL,
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

-- ── monthly_exchange_rate — tỷ giá hàng loạt theo tháng ─────────────────────
CREATE TABLE IF NOT EXISTS `monthly_exchange_rate` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `rate_month`    DATE          NOT NULL,
  `from_currency` VARCHAR(10)   NOT NULL DEFAULT 'USD',
  `to_currency`   VARCHAR(10)   NOT NULL DEFAULT 'VND',
  `rate`          DECIMAL(15,4) NOT NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`    DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  UNIQUE KEY `uq_rate_month_pair` (`rate_month`, `from_currency`, `to_currency`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
