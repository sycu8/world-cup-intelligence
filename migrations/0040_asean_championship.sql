-- ASEAN Championship (AFF Cup) as a regional hub alongside club leagues.
-- Synthetic year 26105 satisfies UNIQUE(year) without rebuilding tournaments.

INSERT OR IGNORE INTO tournaments (
  id, year, name, slug, region, competition_type, season, espn_slug, country_code,
  teams_count, status, start_date, end_date
) VALUES
  (
    't-asean-champ',
    26105,
    'ASEAN Championship',
    'asean-championship',
    'asean',
    'continental_cup',
    '2025-2026',
    'aff.championship',
    NULL,
    10,
    'live',
    '2024-12-08',
    '2026-01-05'
  );
