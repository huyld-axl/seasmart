-- MCAH-01. Additive upgrade; historical extraction and change logs remain untouched.
-- Run ONLY through the MCAH target-validated migration runner. DDL implicitly commits.
ALTER TABLE seafarer ADD COLUMN aggregate_revision INT NOT NULL DEFAULT 0,
  ADD COLUMN lock_version INT NOT NULL DEFAULT 0;
ALTER TABLE vessel ADD COLUMN lock_version INT NOT NULL DEFAULT 0;
ALTER TABLE seafarer_document
  MODIFY COLUMN seafarer_id INT NULL,
  ADD COLUMN source_type VARCHAR(20) NOT NULL DEFAULT 'DOCUMENT',
  ADD COLUMN sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  ADD COLUMN page_count SMALLINT NULL,
  ADD COLUMN schema_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN lock_version INT NOT NULL DEFAULT 0,
  ADD COLUMN unbound_creator_id INT GENERATED ALWAYS AS (CASE WHEN seafarer_id IS NULL THEN created_by ELSE NULL END) STORED,
  ADD UNIQUE KEY uq_document_intake_hash (unbound_creator_id, sha256),
  ADD CONSTRAINT chk_document_intake_actor CHECK (schema_version = 1 OR seafarer_id IS NOT NULL OR created_by IS NOT NULL),
  ADD UNIQUE KEY uq_document_profile (id, seafarer_id),
  ADD UNIQUE KEY uq_document_hash (seafarer_id, sha256),
  ADD CONSTRAINT chk_document_pages CHECK (page_count IS NULL OR page_count BETWEEN 1 AND 50),
  ADD CONSTRAINT chk_document_source CHECK (source_type IN ('DOCUMENT','EXCEL','MANUAL'));

CREATE TABLE document_page (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  page_index SMALLINT NOT NULL,
  printed_page_label VARCHAR(100) NULL,
  page_type VARCHAR(40) NOT NULL DEFAULT 'UNKNOWN',
  storage_path VARCHAR(500) NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  schema_version SMALLINT NOT NULL DEFAULT 2,
  UNIQUE KEY uq_page_position (document_id, page_index),
  UNIQUE KEY uq_page_document (id, document_id),
  FOREIGN KEY (document_id) REFERENCES seafarer_document(id),
  CHECK (page_index BETWEEN 1 AND 50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE extraction_job (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  job_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'QUEUED',
  attempt_count SMALLINT NOT NULL DEFAULT 0,
  available_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  lease_token VARCHAR(100) NULL,
  lease_until DATETIME(6) NULL,
  error_code VARCHAR(50) NULL,
  lock_version INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_job_key (document_id, job_key),
  UNIQUE KEY uq_job_document (id, document_id),
  KEY idx_job_claim (state, available_at, lease_until, id),
  FOREIGN KEY (document_id) REFERENCES seafarer_document(id),
  CHECK (state IN ('QUEUED','RUNNING','SUCCEEDED','FAILED','CANCELLED')),
  CHECK (attempt_count BETWEEN 0 AND 3),
  CHECK (state <> 'RUNNING' OR (lease_token IS NOT NULL AND lease_until IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE extraction_run (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  document_id INT NOT NULL,
  attempt_no SMALLINT NOT NULL,
  provider VARCHAR(40) NOT NULL,
  model VARCHAR(150) NOT NULL,
  prompt_version VARCHAR(40) NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 2,
  provider_request_id VARCHAR(200) NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
  latency_ms INT NULL,
  usage_json JSON NULL,
  error_code VARCHAR(50) NULL,
  error_message VARCHAR(500) NULL,
  started_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  finished_at DATETIME(6) NULL,
  UNIQUE KEY uq_run_attempt (job_id, attempt_no),
  UNIQUE KEY uq_run_document (id, document_id),
  FOREIGN KEY (job_id, document_id) REFERENCES extraction_job(id, document_id),
  CHECK (attempt_no BETWEEN 1 AND 3),
  CHECK (state IN ('RUNNING','SUCCEEDED','FAILED'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- document_field is the proposal entity. v1 rows keep legacy values and keys.
-- Empty record_key and generation=0 are reserved for legacy; v2 uses stable record UUIDs.
ALTER TABLE document_field DROP INDEX uq_doc_field,
  ADD COLUMN page_id INT NULL,
  ADD COLUMN run_id INT NULL,
  ADD COLUMN generation INT NOT NULL DEFAULT 0,
  ADD COLUMN record_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT '',
  ADD COLUMN record_type VARCHAR(30) NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN raw_json JSON NULL,
  ADD COLUMN value_json JSON NULL,
  ADD COLUMN missing_reason VARCHAR(100) NULL,
  ADD COLUMN critical BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN schema_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN source_locator JSON NULL,
  ADD COLUMN lock_version INT NOT NULL DEFAULT 0,
  ADD UNIQUE KEY uq_proposal_identity (document_id, generation, record_key, field_key),
  ADD UNIQUE KEY uq_proposal_document (id, document_id),
  ADD KEY idx_proposal_page (page_id, document_id),
  ADD KEY idx_proposal_review (document_id, schema_version, state, id),
  ADD FOREIGN KEY (page_id, document_id) REFERENCES document_page(id, document_id),
  ADD FOREIGN KEY (run_id, document_id) REFERENCES extraction_run(id, document_id),
  ADD CONSTRAINT chk_proposal_v2 CHECK (schema_version = 1 OR
    (schema_version = 2 AND page_id IS NOT NULL AND record_key <> '' AND
     ((run_id IS NOT NULL AND generation = run_id) OR (run_id IS NULL AND generation = 0)) AND
     record_type IN ('IDENTITY','SEA_SERVICE','CERTIFICATE') AND
     ai_state IN ('PROPOSED','UNKNOWN','DATE_AMBIGUOUS') AND
     state IN ('PROPOSED','UNKNOWN','DATE_AMBIGUOUS','ACCEPTED','EDITED','REJECTED','UNKNOWN_KEPT') AND
     (ai_state <> 'UNKNOWN' OR (missing_reason IS NOT NULL AND CHAR_LENGTH(TRIM(missing_reason)) > 0 AND (value_json IS NULL OR JSON_TYPE(value_json) = 'NULL')))));

CREATE TABLE review_decision (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proposal_id INT NOT NULL,
  proposal_version INT NOT NULL,
  actor_id INT NOT NULL,
  action VARCHAR(20) NOT NULL,
  value_json JSON NULL,
  reason VARCHAR(500) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_decision_version (proposal_id, proposal_version),
  FOREIGN KEY (proposal_id) REFERENCES document_field(id),
  FOREIGN KEY (actor_id) REFERENCES user(id),
  CHECK (action IN ('accept','edit','reject','keepUnknown','undo')),
  CHECK (action NOT IN ('edit','reject') OR (reason IS NOT NULL AND CHAR_LENGTH(TRIM(reason)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sea_service (
  id INT AUTO_INCREMENT PRIMARY KEY,
  seafarer_id INT NOT NULL,
  source_document_id INT NOT NULL,
  source_page_id INT NOT NULL,
  source_record_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  vessel_name_raw VARCHAR(500) NULL,
  rank_raw VARCHAR(500) NULL,
  vessel_id INT NULL,
  rank_id INT NULL,
  sign_on DATE NULL,
  sign_off DATE NULL,
  sign_on_precision VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
  sign_off_precision VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
  sign_on_raw VARCHAR(500) NULL,
  sign_off_raw VARCHAR(500) NULL,
  sign_on_missing_reason VARCHAR(100) NULL,
  sign_off_missing_reason VARCHAR(100) NULL,
  embark_port_raw VARCHAR(500) NULL,
  disembark_port_raw VARCHAR(500) NULL,
  embark_port_id INT NULL,
  disembark_port_id INT NULL,
  ongoing BOOLEAN NOT NULL DEFAULT FALSE,
  ongoing_confirmed_by INT NULL,
  ongoing_confirmed_at DATETIME(6) NULL,
  field_values JSON NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 2,
  lock_version INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  deleted_at DATETIME(6) NULL,
  UNIQUE KEY uq_service_source (source_document_id, source_record_key),
  UNIQUE KEY uq_service_profile (id, seafarer_id),
  KEY idx_service_profile_date (seafarer_id, deleted_at, sign_on, id),
  FOREIGN KEY (seafarer_id) REFERENCES seafarer(id),
  FOREIGN KEY (source_document_id, seafarer_id) REFERENCES seafarer_document(id, seafarer_id),
  FOREIGN KEY (source_page_id, source_document_id) REFERENCES document_page(id, document_id),
  FOREIGN KEY (vessel_id) REFERENCES vessel(id),
  FOREIGN KEY (rank_id) REFERENCES `rank`(id),
  FOREIGN KEY (embark_port_id) REFERENCES port(id),
  FOREIGN KEY (disembark_port_id) REFERENCES port(id),
  FOREIGN KEY (ongoing_confirmed_by) REFERENCES user(id),
  CHECK (source_record_key <> ''),
  CHECK (sign_on_precision IN ('EXACT','MONTH','YEAR','AMBIGUOUS','UNKNOWN')),
  CHECK (sign_off_precision IN ('EXACT','MONTH','YEAR','AMBIGUOUS','UNKNOWN')),
  CHECK ((sign_on_precision = 'EXACT' AND sign_on IS NOT NULL) OR (sign_on_precision <> 'EXACT' AND sign_on IS NULL)),
  CHECK ((sign_off_precision = 'EXACT' AND sign_off IS NOT NULL) OR (sign_off_precision <> 'EXACT' AND sign_off IS NULL)),
  CHECK (sign_on IS NULL OR sign_off IS NULL OR sign_off >= sign_on),
  CHECK (ongoing = 0 OR (sign_off IS NULL AND ongoing_confirmed_by IS NOT NULL AND ongoing_confirmed_at IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE vessel_verification (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sea_service_id INT NOT NULL,
  service_version INT NOT NULL,
  vessel_id INT NULL,
  vessel_version INT NULL,
  state VARCHAR(20) NOT NULL DEFAULT 'NOT_CHECKED',
  evidence_type VARCHAR(30) NULL,
  evidence_reference VARCHAR(1000) NULL,
  evidence_document_id INT NULL,
  evidence_json JSON NULL,
  reason VARCHAR(500) NULL,
  checked_by INT NOT NULL,
  checked_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_verification_version (sea_service_id, service_version),
  FOREIGN KEY (sea_service_id) REFERENCES sea_service(id),
  FOREIGN KEY (vessel_id) REFERENCES vessel(id),
  FOREIGN KEY (checked_by) REFERENCES user(id),
  FOREIGN KEY (evidence_document_id) REFERENCES seafarer_document(id),
  CHECK (state IN ('NOT_CHECKED','VERIFIED','CONFLICT','NOT_FOUND','UNAVAILABLE')),
  CHECK (state <> 'VERIFIED' OR (vessel_id IS NOT NULL AND vessel_version IS NOT NULL AND
    evidence_type IS NOT NULL AND evidence_reference IS NOT NULL AND CHAR_LENGTH(TRIM(evidence_reference)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE seafarer_revision
  ADD COLUMN revision_no INT NULL,
  ADD COLUMN schema_version SMALLINT NOT NULL DEFAULT 1,
  ADD COLUMN snapshot JSON NULL,
  ADD UNIQUE KEY uq_revision_number (seafarer_id, revision_no),
  ADD UNIQUE KEY uq_revision_profile (id, seafarer_id),
  ADD CONSTRAINT chk_revision_snapshot CHECK (schema_version = 1 OR
    (schema_version = 2 AND revision_no > 0 AND snapshot IS NOT NULL AND
     JSON_CONTAINS_PATH(snapshot, 'all', '$.profile', '$.sea_service', '$.sources', '$.certificates', '$.contacts') = 1));

CREATE TABLE mcah_audit (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id INT NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(40) NOT NULL,
  entity_id INT NOT NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  reason VARCHAR(500) NOT NULL,
  request_id VARCHAR(100) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_audit_entity (entity_type, entity_id, id),
  FOREIGN KEY (actor_id) REFERENCES user(id),
  CHECK (CHAR_LENGTH(TRIM(reason)) > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE owner_policy (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  version INT NOT NULL,
  contact_mode VARCHAR(20) NOT NULL,
  config JSON NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_policy_version (owner_id, version),
  UNIQUE KEY uq_policy_owner (id, owner_id),
  FOREIGN KEY (owner_id) REFERENCES ship_owner(id),
  FOREIGN KEY (created_by) REFERENCES user(id),
  CHECK (version > 0),
  CHECK (contact_mode IN ('CREW_CONTACT','HIDE','AGENCY_CONTACT'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE owner_template (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  template_key VARCHAR(80) NOT NULL,
  export_type VARCHAR(20) NOT NULL,
  version INT NOT NULL,
  mapping_version INT NOT NULL,
  storage_path VARCHAR(500) NOT NULL,
  sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mapping JSON NOT NULL,
  created_by INT NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  UNIQUE KEY uq_template_version (owner_id, template_key, version),
  UNIQUE KEY uq_template_owner (id, owner_id),
  FOREIGN KEY (owner_id) REFERENCES ship_owner(id),
  FOREIGN KEY (created_by) REFERENCES user(id),
  CHECK (export_type IN ('CV','CREW_LIST')),
  CHECK (version > 0 AND mapping_version > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Owner exports do not reuse export_pack: that entity has a signing workflow.
CREATE TABLE owner_export (
  id INT AUTO_INCREMENT PRIMARY KEY,
  owner_id INT NOT NULL,
  template_id INT NOT NULL,
  policy_id INT NOT NULL,
  state VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  snapshot JSON NOT NULL,
  schema_version SMALLINT NOT NULL DEFAULT 2,
  as_of DATE NOT NULL,
  valid_until DATETIME(6) NOT NULL,
  created_by INT NOT NULL,
  approved_by INT NULL,
  approved_at DATETIME(6) NULL,
  reason VARCHAR(500) NULL,
  artifact_path VARCHAR(500) NULL,
  artifact_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  lock_version INT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  KEY idx_export_state (state, id),
  FOREIGN KEY (template_id, owner_id) REFERENCES owner_template(id, owner_id),
  FOREIGN KEY (policy_id, owner_id) REFERENCES owner_policy(id, owner_id),
  FOREIGN KEY (created_by) REFERENCES user(id),
  FOREIGN KEY (approved_by) REFERENCES user(id),
  CHECK (state IN ('DRAFT','PENDING_APPROVAL','RELEASED','REJECTED','STALE')),
  CHECK (approved_by IS NULL OR approved_by <> created_by),
  CHECK (state <> 'RELEASED' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL AND artifact_path IS NOT NULL AND artifact_sha256 IS NOT NULL)),
  CHECK (state NOT IN ('REJECTED','STALE') OR (reason IS NOT NULL AND CHAR_LENGTH(TRIM(reason)) > 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE owner_export_profile (
  export_id INT NOT NULL,
  seafarer_id INT NOT NULL,
  revision_id INT NOT NULL,
  PRIMARY KEY (export_id, seafarer_id),
  KEY idx_export_dependency (seafarer_id, revision_id, export_id),
  FOREIGN KEY (export_id) REFERENCES owner_export(id),
  FOREIGN KEY (revision_id, seafarer_id) REFERENCES seafarer_revision(id, seafarer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE owner_export_vessel (
  export_id INT NOT NULL,
  vessel_id INT NOT NULL,
  vessel_version INT NOT NULL,
  PRIMARY KEY (export_id, vessel_id),
  FOREIGN KEY (export_id) REFERENCES owner_export(id),
  FOREIGN KEY (vessel_id) REFERENCES vessel(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE mcah_idempotency (
  actor_id INT NOT NULL,
  scope VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  idempotency_key VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  response_status SMALLINT NULL,
  response_json JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (actor_id, scope, idempotency_key),
  FOREIGN KEY (actor_id) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Historical logs are not reconstructable snapshots. Keep them schema_version=1.
-- New baseline revision records the current aggregate, not a fabricated historical state.
INSERT INTO seafarer_revision (seafarer_id, reason, changes, revision_no, schema_version, snapshot)
SELECT s.id, 'MCAH-01 baseline aggregate; historical logs retained separately', JSON_OBJECT(), 1, 2,
JSON_OBJECT('schema_version', 2, 'revision_no', 1, 'profile', JSON_OBJECT('id', s.`id`, 'seafarer_code', s.`seafarer_code`, 'national_id', s.`national_id`, 'national_id_issued_date', s.`national_id_issued_date`, 'national_id_issued_place', s.`national_id_issued_place`, 'passport_number', s.`passport_number`, 'passport_issued_date', s.`passport_issued_date`, 'passport_expiry', s.`passport_expiry`, 'seaman_book_number', s.`seaman_book_number`, 'seaman_book_expiry', s.`seaman_book_expiry`, 'vietnam_registry_id', s.`vietnam_registry_id`, 'full_name', s.`full_name`, 'full_name_en', s.`full_name_en`, 'date_of_birth', s.`date_of_birth`, 'place_of_birth', s.`place_of_birth`, 'gender', s.`gender`, 'marital_status', s.`marital_status`, 'children_count', s.`children_count`, 'children_info', s.`children_info`, 'children_ages', s.`children_ages`, 'nationality_id', s.`nationality_id`, 'ethnicity', s.`ethnicity`, 'religion', s.`religion`, 'permanent_address', s.`permanent_address`, 'permanent_ward', s.`permanent_ward`, 'permanent_district', s.`permanent_district`, 'permanent_province', s.`permanent_province`, 'contact_address', s.`contact_address`, 'phone_primary', s.`phone_primary`, 'phone_secondary', s.`phone_secondary`, 'email', s.`email`, 'height_cm', s.`height_cm`, 'weight_kg', s.`weight_kg`, 'shirt_size', s.`shirt_size`, 'pants_size', s.`pants_size`, 'shoe_size', s.`shoe_size`, 'blood_type', s.`blood_type`, 'medical_cert_number', s.`medical_cert_number`, 'medical_cert_expiry', s.`medical_cert_expiry`, 'education_level', s.`education_level`, 'education_major', s.`education_major`, 'education_school', s.`education_school`, 'english_level', s.`english_level`, 'english_score', s.`english_score`, 'current_rank_id', s.`current_rank_id`, 'bank_account_number', s.`bank_account_number`, 'bank_account_holder', s.`bank_account_holder`, 'bank_name', s.`bank_name`, 'bank_branch', s.`bank_branch`, 'social_insurance_number', s.`social_insurance_number`, 'social_insurance_joined', s.`social_insurance_joined`, 'social_insurance_date', s.`social_insurance_date`, 'status', s.`status`, 'notes', s.`notes`, 'user_id', s.`user_id`, 'created_by', s.`created_by`, 'updated_by', s.`updated_by`, 'created_at', s.`created_at`, 'updated_at', s.`updated_at`, 'deleted_at', s.`deleted_at`, 'vessel_group', s.`vessel_group`, 'vessel_name_raw', s.`vessel_name_raw`, 'contract_flight_date', s.`contract_flight_date`, 'contract_start_date', s.`contract_start_date`, 'contract_duration_raw', s.`contract_duration_raw`, 'contract_salary_raw', s.`contract_salary_raw`, 'contract_end_date', s.`contract_end_date`, 'contract_return_date', s.`contract_return_date`, 'rank_name_vi', s.`rank_name_vi`),
'sea_service', JSON_ARRAY(),
'sources', COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', d.`id`, 'seafarer_id', d.`seafarer_id`, 'file_name', d.`file_name`, 'mime_type', d.`mime_type`, 'file_size', d.`file_size`, 'storage_path', d.`storage_path`, 'doc_type', d.`doc_type`, 'page_label', d.`page_label`, 'status', d.`status`, 'error', d.`error`, 'published_at', d.`published_at`, 'published_by', d.`published_by`, 'created_by', d.`created_by`, 'created_at', d.`created_at`, 'updated_at', d.`updated_at`, 'deleted_at', d.`deleted_at`)) FROM seafarer_document d WHERE d.seafarer_id = s.id), JSON_ARRAY()),
'certificates', COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', c.`id`, 'seafarer_id', c.`seafarer_id`, 'certificate_type_id', c.`certificate_type_id`, 'certificate_number', c.`certificate_number`, 'issued_date', c.`issued_date`, 'expiry_date', c.`expiry_date`, 'issued_by', c.`issued_by`, 'issued_at_country_id', c.`issued_at_country_id`, 'status', c.`status`, 'document_url', c.`document_url`, 'notes', c.`notes`, 'created_at', c.`created_at`, 'updated_at', c.`updated_at`, 'deleted_at', c.`deleted_at`, 'created_by', c.`created_by`, 'updated_by', c.`updated_by`)) FROM seafarer_certificate c WHERE c.seafarer_id = s.id), JSON_ARRAY()),
'contacts', COALESCE((SELECT JSON_ARRAYAGG(JSON_OBJECT('id', c.`id`, 'seafarer_id', c.`seafarer_id`, 'relationship', c.`relationship`, 'is_emergency_contact', c.`is_emergency_contact`, 'is_guarantor', c.`is_guarantor`, 'full_name', c.`full_name`, 'date_of_birth', c.`date_of_birth`, 'national_id', c.`national_id`, 'phone_primary', c.`phone_primary`, 'phone_secondary', c.`phone_secondary`, 'email', c.`email`, 'address', c.`address`, 'ward', c.`ward`, 'district', c.`district`, 'province', c.`province`, 'occupation', c.`occupation`, 'workplace', c.`workplace`, 'guarantor_id_number', c.`guarantor_id_number`, 'guarantor_id_issued_date', c.`guarantor_id_issued_date`, 'guarantor_id_issued_place', c.`guarantor_id_issued_place`, 'created_at', c.`created_at`, 'updated_at', c.`updated_at`)) FROM seafarer_contact c WHERE c.seafarer_id = s.id), JSON_ARRAY()))
FROM seafarer s;
UPDATE seafarer SET aggregate_revision = 1, updated_at = updated_at;

INSERT INTO mcah_audit (action, entity_type, entity_id, after_json, reason)
SELECT 'BASELINE_SNAPSHOT', 'seafarer', id, JSON_OBJECT('revision_no', 1),
'MCAH-01 migration: current aggregate baseline; no historical state inferred' FROM seafarer;
