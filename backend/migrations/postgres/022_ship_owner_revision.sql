CREATE TABLE IF NOT EXISTS ship_owner_revision (
  id BIGSERIAL PRIMARY KEY,
  ship_owner_id BIGINT NOT NULL REFERENCES ship_owner(id),
  changed_by BIGINT,
  changes JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ship_owner_revision_owner_idx ON ship_owner_revision(ship_owner_id, created_at);
