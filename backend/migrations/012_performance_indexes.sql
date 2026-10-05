-- Migration 012: Performance indexes for 60k seafarers scale
-- Run: mysql -u root marineport < migrations/012_performance_indexes.sql

-- seafarer: index on deleted_at (every query filters this)
ALTER TABLE seafarer ADD INDEX idx_seafarer_deleted (deleted_at);

-- seafarer: index on email for portal lookups
ALTER TABLE seafarer ADD INDEX idx_seafarer_email (email);

-- seafarer: composite index for search (prefix search on full_name)
ALTER TABLE seafarer ADD INDEX idx_seafarer_fullname (full_name);
ALTER TABLE seafarer ADD INDEX idx_seafarer_national_id (national_id);
ALTER TABLE seafarer ADD INDEX idx_seafarer_code (seafarer_code);

-- seafarer_certificate: index on deleted_at
ALTER TABLE seafarer_certificate ADD INDEX idx_cert_deleted (deleted_at);

-- seafarer_certificate: composite index for seafarer + deleted_at
ALTER TABLE seafarer_certificate ADD INDEX idx_cert_seafarer_deleted (seafarer_id, deleted_at);

-- seafarer_certificate: index on expiry_date for background job
ALTER TABLE seafarer_certificate ADD INDEX idx_cert_expiry_status (expiry_date, status);

-- employment_contract: index on deleted_at
ALTER TABLE employment_contract ADD INDEX idx_contract_deleted (deleted_at);

-- otp_verification: index on expires_at for cleanup job
ALTER TABLE otp_verification ADD INDEX idx_otp_expires (expires_at);
