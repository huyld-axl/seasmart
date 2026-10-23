-- Zalo is explicitly supplied; do not assume existing phone numbers use Zalo.
ALTER TABLE ship_owner ADD COLUMN zalo varchar(300);
ALTER TABLE ship_owner_contact ADD COLUMN zalo varchar(300);
ALTER TABLE seafarer ADD COLUMN zalo varchar(300);
ALTER TABLE seafarer_contact ADD COLUMN zalo varchar(300);
