-- Multi-competition support: La Liga, J1 League, V.League 1, CAF Champions League.
-- Drop UNIQUE(year) so several 2026-season competitions can coexist with WC 2026.

PRAGMA foreign_keys=off;

CREATE TABLE IF NOT EXISTS tournaments_v2 (
  id TEXT PRIMARY KEY,
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  region TEXT,
  competition_type TEXT,
  season TEXT,
  espn_slug TEXT,
  country_code TEXT,
  host_countries_json TEXT,
  start_date TEXT,
  end_date TEXT,
  teams_count INTEGER,
  status TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO tournaments_v2 (
  id, year, name, slug, region, competition_type, season, espn_slug, country_code,
  host_countries_json, start_date, end_date, teams_count, status, created_at, updated_at
)
SELECT
  id,
  year,
  name,
  CASE WHEN id = 't-2026' THEN 'world-cup-2026' ELSE NULL END,
  CASE WHEN id = 't-2026' THEN 'world' ELSE NULL END,
  CASE WHEN id = 't-2026' THEN 'world_cup' ELSE NULL END,
  CASE WHEN id = 't-2026' THEN '2026' ELSE NULL END,
  CASE WHEN id = 't-2026' THEN 'fifa.world' ELSE NULL END,
  NULL,
  host_countries_json,
  start_date,
  end_date,
  teams_count,
  status,
  created_at,
  updated_at
FROM tournaments;

DROP TABLE tournaments;
ALTER TABLE tournaments_v2 RENAME TO tournaments;

CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON tournaments(slug);
CREATE INDEX IF NOT EXISTS idx_tournaments_region ON tournaments(region);

PRAGMA foreign_keys=on;

INSERT OR IGNORE INTO tournaments (
  id, year, name, slug, region, competition_type, season, espn_slug, country_code,
  teams_count, status, start_date, end_date
) VALUES
  ('t-vleague', 2026, 'V.League 1', 'v-league-1', 'vietnam', 'domestic_league', '2026/27', 'vie.1', 'VN', 14, 'live', '2026-08-01', '2027-06-30'),
  ('t-j1', 2026, 'J1 League', 'j1-league', 'japan', 'domestic_league', '2026', 'jpn.1', 'JP', 20, 'live', '2026-02-01', '2026-12-10'),
  ('t-la-liga', 2026, 'La Liga', 'la-liga', 'europe', 'domestic_league', '2026/27', 'esp.1', 'ES', 20, 'live', '2026-08-15', '2027-05-31'),
  ('t-caf-cl', 2026, 'CAF Champions League', 'caf-champions-league', 'africa', 'continental_cup', '2026/27', 'caf.champions', NULL, 16, 'live', '2026-08-01', '2027-05-31');

ALTER TABLE matches ADD COLUMN source_event_id TEXT;
ALTER TABLE matches ADD COLUMN matchweek INTEGER;

CREATE INDEX IF NOT EXISTS idx_matches_source_event ON matches(source_event_id);
CREATE INDEX IF NOT EXISTS idx_matches_tournament_status ON matches(tournament_id, status);

ALTER TABLE source_documents ADD COLUMN tournament_id TEXT;
CREATE INDEX IF NOT EXISTS idx_source_documents_tournament ON source_documents(tournament_id);

CREATE TABLE IF NOT EXISTS league_table_rows (
  tournament_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  group_code TEXT NOT NULL DEFAULT '',
  rank INTEGER NOT NULL,
  played INTEGER DEFAULT 0,
  won INTEGER DEFAULT 0,
  drawn INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  gf INTEGER DEFAULT 0,
  ga INTEGER DEFAULT 0,
  gd INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  form TEXT,
  updated_at TEXT,
  PRIMARY KEY (tournament_id, team_id, group_code)
);

CREATE INDEX IF NOT EXISTS idx_league_table_rank ON league_table_rows(tournament_id, group_code, rank);

CREATE TABLE IF NOT EXISTS league_scorers (
  tournament_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_id TEXT,
  player_name TEXT NOT NULL,
  team_name TEXT,
  goals INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  updated_at TEXT,
  PRIMARY KEY (tournament_id, player_id)
);

INSERT OR IGNORE INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, health_status)
VALUES
  ('src-espn-leagues', 'ESPN Soccer Leagues', 'api', 'https://site.api.espn.com/apis/site/v2/sports/soccer', 0.82, 'scores,standings,news', 'unknown'),
  ('src-thesportsdb', 'TheSportsDB', 'api', 'https://www.thesportsdb.com/api/v1/json', 0.7, 'vleague-fallback', 'unknown');
