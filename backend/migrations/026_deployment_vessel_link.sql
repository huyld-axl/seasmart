-- 026_deployment_vessel_link.sql
-- Hybrid deployment-vessel model: keep snapshot fields + optional vessel_id link

ALTER TABLE seafarer_deployment
  ADD COLUMN vessel_id INT NULL AFTER seafarer_id;

ALTER TABLE seafarer_deployment
  ADD INDEX idx_deployment_vessel (vessel_id);

ALTER TABLE seafarer_deployment
  ADD CONSTRAINT fk_deployment_vessel
    FOREIGN KEY (vessel_id) REFERENCES vessel(id) ON DELETE SET NULL;
