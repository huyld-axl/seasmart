ALTER TABLE ship_owner RENAME TO partner;

ALTER TABLE vessel
  CHANGE COLUMN ship_owner_id partner_id INT NULL;

ALTER TABLE job
  CHANGE COLUMN ship_owner_id partner_id INT NOT NULL;

ALTER TABLE employment_contract
  CHANGE COLUMN ship_owner_id partner_id INT NOT NULL;

ALTER TABLE partner
  ADD COLUMN payment_cycle VARCHAR(50) NULL AFTER tax_id,
  ADD COLUMN payment_terms TEXT NULL AFTER payment_cycle;
