-- 022_deployment_job_link.sql
-- Add job linkage and cancelled status for deployment workflow

ALTER TABLE seafarer_deployment
  MODIFY COLUMN status ENUM('collecting_docs','confirmed','pre_boarding','onboard','signed_off','cancelled')
    NOT NULL DEFAULT 'collecting_docs';

ALTER TABLE seafarer_deployment
  ADD COLUMN job_id INT NULL AFTER seafarer_id;

ALTER TABLE seafarer_deployment
  ADD INDEX idx_deployment_job (job_id);

ALTER TABLE seafarer_deployment
  ADD CONSTRAINT fk_deployment_job
    FOREIGN KEY (job_id) REFERENCES `job`(id) ON DELETE SET NULL;

