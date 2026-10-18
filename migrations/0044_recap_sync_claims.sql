-- One recap sync claim per match. expires_at is epoch milliseconds.
-- Not applied in this change. Apply with the other pending migrations on deploy.
CREATE TABLE IF NOT EXISTS recap_sync_claims (
  match_id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  last_sync_at INTEGER
);
