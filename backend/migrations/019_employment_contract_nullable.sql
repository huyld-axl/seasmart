-- Migration 019: Allow NULL on employment_contract columns that are optional in the UI
ALTER TABLE `employment_contract`
  MODIFY `contract_number`  VARCHAR(50)   NULL,
  MODIFY `vessel_id`        INT           NULL,
  MODIFY `ship_owner_id`    INT           NULL,
  MODIFY `rank_id`          INT           NULL,
  MODIFY `sign_date`        DATE          NULL,
  MODIFY `start_date`       DATE          NULL,
  MODIFY `basic_wage_usd`   DECIMAL(10,2) NULL;
