-- Atomic counters for DLQ parks, stale drops, and the replay cursor.
-- KV keeps about one write per second per key, so a batch of increments collapsed to 1.
CREATE TABLE IF NOT EXISTS pipeline_counters (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);
