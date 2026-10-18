-- Speed up latest-snapshot lookup for WC tournament boards (homepage schedule).
CREATE INDEX IF NOT EXISTS idx_probability_snapshots_match_id_id
ON probability_snapshots(match_id, id DESC);
