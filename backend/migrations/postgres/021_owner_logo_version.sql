ALTER TABLE ship_owner ADD COLUMN logo_updated_at timestamptz;
UPDATE ship_owner SET logo_updated_at = updated_at WHERE logo_path IS NOT NULL;
