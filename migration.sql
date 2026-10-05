-- ============================================================
-- MarinePort — MySQL Migration Script
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
  `category`            ENUM('STCW','VN','DOCUMENT','MEDICAL','PANAMA','OTHER')
                                      NOT NULL DEFAULT 'OTHER'
                                      COMMENT 'Nhóm chứng chỉ',
  `abbreviation`        VARCHAR(30)   NULL     COMMENT 'Ký hiệu viết tắt nghiệp vụ (PP, SMB, IMO, AFF...)',
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
  `role`                  VARCHAR(30)   NOT NULL COMMENT 'admin|operator|training_center|manning_agent|seafarer',
  `verification_status`   VARCHAR(20)   NOT NULL DEFAULT 'unverified' COMMENT 'unverified|pending|verified',
  `linked_entity_type`    VARCHAR(30)   NULL COMMENT 'seafarer|training_center|manning_agent',
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
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `seafarer_code`         VARCHAR(30)   NULL,
  `national_id`           VARCHAR(20)   NULL,
  `passport_number`       VARCHAR(20)   NULL,
  `passport_expiry`       DATE          NULL,
  `seaman_book_number`    VARCHAR(30)   NULL,
  `seaman_book_expiry`    DATE          NULL,
  `vietnam_registry_id`   VARCHAR(30)   NULL,
  `full_name`             VARCHAR(150)  NOT NULL,
  `full_name_en`          VARCHAR(150)  NULL,
  `date_of_birth`         DATE          NOT NULL,
  `place_of_birth`        VARCHAR(200)  NULL,
  `gender`                CHAR(1)       NOT NULL DEFAULT 'M',
  `nationality_id`        INT           NOT NULL,
  `ethnicity`             VARCHAR(50)   NULL,
  `religion`              VARCHAR(50)   NULL,
  `permanent_address`     TEXT          NULL,
  `permanent_ward`        VARCHAR(100)  NULL,
  `permanent_district`    VARCHAR(100)  NULL,
  `permanent_province`    VARCHAR(100)  NULL,
  `contact_address`       TEXT          NULL,
  `phone_primary`         VARCHAR(20)   NULL,
  `phone_secondary`       VARCHAR(20)   NULL,
  `email`                 VARCHAR(150)  NULL,
  `height_cm`             SMALLINT      NULL,
  `weight_kg`             SMALLINT      NULL,
  `blood_type`            VARCHAR(5)    NULL,
  `medical_cert_number`   VARCHAR(50)   NULL,
  `medical_cert_expiry`   DATE          NULL,
  `education_level`       VARCHAR(50)   NULL,
  `education_major`       VARCHAR(150)  NULL,
  `education_school`      VARCHAR(200)  NULL,
  `english_level`         VARCHAR(50)   NULL,
  `english_score`         SMALLINT      NULL,
  `current_rank_id`       INT           NULL,
  `bank_account_number`   VARCHAR(30)   NULL,
  `bank_name`             VARCHAR(100)  NULL,
  `bank_branch`           VARCHAR(150)  NULL,
  `social_insurance_number` VARCHAR(20) NULL,
  `social_insurance_date` DATE          NULL,
  `status`                VARCHAR(30)   NOT NULL DEFAULT 'AVAILABLE' COMMENT 'AVAILABLE|ON_VESSEL|ON_LEAVE|TRAINING|BLACKLISTED|RETIRED|INACTIVE',
  `notes`                 TEXT          NULL,
  `user_id`               INT           NULL,
  `created_by`            INT           NULL,
  `updated_by`            INT           NULL,
  `created_at`            DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`            DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`            DATETIME      NULL,
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

-- ── 14. ship_owner ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ship_owner` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `code`             VARCHAR(30)   NOT NULL UNIQUE,
  `company_name`     VARCHAR(200)  NOT NULL,
  `company_name_en`  VARCHAR(200)  NULL,
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
  `is_active`        TINYINT(1)    NOT NULL DEFAULT 1,
  `notes`            TEXT          NULL,
  `created_at`       DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`       DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`       DATETIME      NULL,
  FOREIGN KEY (`country_id`) REFERENCES `country`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 15. vessel ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `vessel` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `imo_number`             VARCHAR(10)   NULL UNIQUE,
  `mmsi`                   VARCHAR(10)   NULL,
  `call_sign`              VARCHAR(10)   NULL,
  `vessel_name`            VARCHAR(150)  NOT NULL,
  `vessel_name_prev`       VARCHAR(150)  NULL,
  `vessel_type_id`         INT           NULL,
  `flag_country_id`        INT           NULL,
  `port_of_registry_id`    INT           NULL,
  `gross_tonnage`          DECIMAL(10,2) NULL,
  `net_tonnage`            DECIMAL(10,2) NULL,
  `deadweight`             DECIMAL(10,2) NULL,
  `length_overall`         DECIMAL(8,2)  NULL,
  `year_built`             SMALLINT      NULL,
  `classification_society` VARCHAR(50)   NULL,
  `ship_owner_id`          INT           NULL,
  `technical_manager`      VARCHAR(200)  NULL,
  `commercial_manager`     VARCHAR(200)  NULL,
  `status`                 VARCHAR(30)   NOT NULL DEFAULT 'IN_SERVICE',
  `notes`                  TEXT          NULL,
  `created_at`             DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`             DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  `deleted_at`             DATETIME      NULL,
  FOREIGN KEY (`vessel_type_id`)      REFERENCES `vessel_type`(`id`),
  FOREIGN KEY (`flag_country_id`)     REFERENCES `country`(`id`),
  FOREIGN KEY (`port_of_registry_id`) REFERENCES `port`(`id`),
  FOREIGN KEY (`ship_owner_id`)       REFERENCES `ship_owner`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 16. vessel_certificate_requirement ──────────────────────
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

-- ── 17. manning_agent ────────────────────────────────────────
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

-- ── 18. employment_contract ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `employment_contract` (
  `id`                      INT AUTO_INCREMENT PRIMARY KEY,
  `contract_number`         VARCHAR(50)    NOT NULL,
  `seafarer_id`             INT            NOT NULL,
  `vessel_id`               INT            NOT NULL,
  `ship_owner_id`           INT            NOT NULL,
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
  FOREIGN KEY (`ship_owner_id`)    REFERENCES `ship_owner`(`id`),
  FOREIGN KEY (`manning_agent_id`) REFERENCES `manning_agent`(`id`),
  FOREIGN KEY (`contract_type_id`) REFERENCES `contract_type`(`id`),
  FOREIGN KEY (`rank_id`)          REFERENCES `rank`(`id`),
  FOREIGN KEY (`sign_on_port_id`)  REFERENCES `port`(`id`),
  FOREIGN KEY (`sign_off_port_id`) REFERENCES `port`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 19. contract_payroll ─────────────────────────────────────
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

-- ── 20. training_center ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `training_center` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `code`           VARCHAR(30)   NOT NULL UNIQUE,
  `name_vi`        VARCHAR(200)  NOT NULL,
  `name_en`        VARCHAR(200)  NULL,
  `country_id`     INT           NULL,
  `license_number` VARCHAR(50)   NULL,
  `license_expiry` DATE          NULL,
  `accredited_by`  VARCHAR(200)  NULL,
  `address`        TEXT          NULL,
  `phone`          VARCHAR(30)   NULL,
  `email`          VARCHAR(150)  NULL,
  `contact_person` VARCHAR(150)  NULL,
  `is_active`      TINYINT(1)    NOT NULL DEFAULT 1,
  `notes`          TEXT          NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`     DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (`country_id`) REFERENCES `country`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 21. training_course ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS `training_course` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `course_code`        VARCHAR(50)    NOT NULL,
  `course_type_id`     INT            NOT NULL,
  `training_center_id` INT            NOT NULL,
  `name`               VARCHAR(200)   NOT NULL,
  `start_date`         DATE           NOT NULL,
  `end_date`           DATE           NULL,
  `location`           VARCHAR(200)   NULL,
  `max_students`       SMALLINT       NULL,
  `fee_vnd`            DECIMAL(12,2)  NULL,
  `fee_usd`            DECIMAL(10,2)  NULL,
  `instructor`         VARCHAR(200)   NULL,
  `status`             VARCHAR(20)    NOT NULL DEFAULT 'PLANNED' COMMENT 'PLANNED|ONGOING|COMPLETED|CANCELLED',
  `notes`              TEXT           NULL,
  `created_at`         DATETIME       NOT NULL DEFAULT NOW(),
  `updated_at`         DATETIME       NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (`course_type_id`)     REFERENCES `course_type`(`id`),
  FOREIGN KEY (`training_center_id`) REFERENCES `training_center`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 22. training_enrollment ──────────────────────────────────
CREATE TABLE IF NOT EXISTS `training_enrollment` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `course_id`          INT           NOT NULL,
  `seafarer_id`        INT           NOT NULL,
  `enrollment_date`    DATE          NOT NULL,
  `rank_at_enrollment` INT           NULL,
  `attendance_score`   DECIMAL(5,2)  NULL,
  `attendance_max`     SMALLINT      NULL DEFAULT 25,
  `process_score`      DECIMAL(5,2)  NULL,
  `interview_score`    DECIMAL(5,2)  NULL,
  `total_score`        DECIMAL(5,2)  NULL,
  `grade`              VARCHAR(5)    NULL,
  `result`             VARCHAR(20)   NULL COMMENT 'PASS|FAIL|ABSENT|WITHDRAWN',
  `certificate_issued` TINYINT(1)    NOT NULL DEFAULT 0,
  `certificate_id`     INT           NULL,
  `absence_reason`     TEXT          NULL,
  `notes`              TEXT          NULL,
  `created_at`         DATETIME      NOT NULL DEFAULT NOW(),
  `updated_at`         DATETIME      NOT NULL DEFAULT NOW() ON UPDATE NOW(),
  FOREIGN KEY (`course_id`)          REFERENCES `training_course`(`id`),
  FOREIGN KEY (`seafarer_id`)        REFERENCES `seafarer`(`id`),
  FOREIGN KEY (`rank_at_enrollment`) REFERENCES `rank`(`id`),
  FOREIGN KEY (`certificate_id`)     REFERENCES `seafarer_certificate`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 23. enrollment_score ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `enrollment_score` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `enrollment_id` INT           NOT NULL,
  `criteria_code` VARCHAR(50)   NOT NULL,
  `criteria_name` VARCHAR(150)  NOT NULL,
  `score`         DECIMAL(5,2)  NULL,
  `max_score`     DECIMAL(5,2)  NULL,
  `grade`         VARCHAR(5)    NULL,
  `notes`         TEXT          NULL,
  `created_at`    DATETIME      NOT NULL DEFAULT NOW(),
  FOREIGN KEY (`enrollment_id`) REFERENCES `training_enrollment`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
CREATE INDEX idx_enrollment_course   ON `training_enrollment` (`course_id`);
CREATE INDEX idx_enrollment_seafarer ON `training_enrollment` (`seafarer_id`);
CREATE INDEX idx_otp_user            ON `otp_verification` (`user_id`, `expires_at`);

SET FOREIGN_KEY_CHECKS = 1;

