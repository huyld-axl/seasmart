-- Add OFFSHIFT and RESERVE to seafarer operational status enum
-- Safe migration: only extends the allowed ENUM values

START TRANSACTION;

ALTER TABLE seafarer
  MODIFY COLUMN status ENUM('STANDBY', 'ONBOARD', 'OFFSHIFT', 'RESERVE', 'SIGNOFF') NOT NULL DEFAULT 'STANDBY';

COMMIT;

-- Note: run this on your production DB using mysql client, e.g.
-- mysql -u$DB_USER -p$DB_NAME < backend/migrations/086_add_seafarer_status_offshift_reserve.sql
