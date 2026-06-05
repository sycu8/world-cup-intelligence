-- Expanded trusted sources, national teams, and reference ratings (FIFA/Elo approx. mid-2025)

INSERT OR IGNORE INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, license_notes, health_status)
VALUES
  ('src-openfootball', 'OpenFootball World Cup', 'open_data', 'https://github.com/openfootball/world-cup', 0.88, 'reference', 'CC0-1.0 public domain', 'healthy'),
  ('src-rss-ap-soccer', 'Associated Press', 'rss', 'https://apnews.com/hub/soccer', 0.84, 'news', 'RSS terms of use', 'healthy'),
  ('src-rss-sky-football', 'Sky Sports', 'rss', 'https://www.skysports.com/football', 0.8, 'news', 'RSS terms of use', 'healthy'),
  ('src-rss-reuters-soccer', 'Reuters', 'rss', 'https://www.reuters.com/sports/soccer/', 0.86, 'news', 'RSS terms of use', 'healthy');

UPDATE source_registry SET
  license_notes = 'StatsBomb open-data — research/non-commercial',
  allowed_usage = 'research',
  reliability_score = 0.9
WHERE id = 'src-statsbomb';

UPDATE source_registry SET
  license_notes = 'Football-Data.org API — free tier with token',
  allowed_usage = 'api'
WHERE id = 'src-football-data';

-- Core nations (refresh ratings)
UPDATE teams SET fifa_ranking = 1, elo_rating = 1985, collective_strength_rating = 0.92 WHERE id = 'team-arg';
UPDATE teams SET fifa_ranking = 2, elo_rating = 1960, collective_strength_rating = 0.91 WHERE id = 'team-fra';
UPDATE teams SET fifa_ranking = 3, elo_rating = 1940, collective_strength_rating = 0.90 WHERE id = 'team-bra';
UPDATE teams SET fifa_ranking = 4, elo_rating = 1890, collective_strength_rating = 0.88 WHERE id = 'team-eng';
UPDATE teams SET fifa_ranking = 12, elo_rating = 1780, collective_strength_rating = 0.78 WHERE id = 'team-usa';
UPDATE teams SET fifa_ranking = 15, elo_rating = 1760, collective_strength_rating = 0.76 WHERE id = 'team-mex';

-- WC 2018/2022 participants + contenders (reference Elo/FIFA mid-2025)
INSERT OR IGNORE INTO teams (id, name, short_name, country_code, confederation, fifa_ranking, elo_rating, collective_strength_rating)
VALUES
  ('team-ger', 'Germany', 'GER', 'DE', 'UEFA', 5, 1920, 0.87),
  ('team-esp', 'Spain', 'ESP', 'ES', 'UEFA', 6, 1910, 0.86),
  ('team-por', 'Portugal', 'POR', 'PT', 'UEFA', 7, 1900, 0.85),
  ('team-ned', 'Netherlands', 'NED', 'NL', 'UEFA', 8, 1885, 0.84),
  ('team-bel', 'Belgium', 'BEL', 'BE', 'UEFA', 9, 1875, 0.83),
  ('team-cro', 'Croatia', 'CRO', 'HR', 'UEFA', 10, 1865, 0.82),
  ('team-ita', 'Italy', 'ITA', 'IT', 'UEFA', 11, 1855, 0.81),
  ('team-mar', 'Morocco', 'MAR', 'MA', 'CAF', 13, 1820, 0.79),
  ('team-col', 'Colombia', 'COL', 'CO', 'CONMEBOL', 14, 1810, 0.78),
  ('team-uru', 'Uruguay', 'URU', 'UY', 'CONMEBOL', 16, 1795, 0.77),
  ('team-sui', 'Switzerland', 'SUI', 'CH', 'UEFA', 17, 1788, 0.76),
  ('team-jpn', 'Japan', 'JPN', 'JP', 'AFC', 18, 1782, 0.75),
  ('team-sen', 'Senegal', 'SEN', 'SN', 'CAF', 19, 1775, 0.74),
  ('team-irn', 'Iran', 'IRN', 'IR', 'AFC', 20, 1768, 0.73),
  ('team-den', 'Denmark', 'DEN', 'DK', 'UEFA', 21, 1762, 0.73),
  ('team-kor', 'South Korea', 'KOR', 'KR', 'AFC', 22, 1755, 0.72),
  ('team-aus', 'Australia', 'AUS', 'AU', 'AFC', 23, 1748, 0.71),
  ('team-ksa', 'Saudi Arabia', 'KSA', 'SA', 'AFC', 24, 1740, 0.70),
  ('team-ecu', 'Ecuador', 'ECU', 'EC', 'CONMEBOL', 25, 1735, 0.70),
  ('team-can', 'Canada', 'CAN', 'CA', 'CONCACAF', 26, 1730, 0.69),
  ('team-ukr', 'Ukraine', 'UKR', 'UA', 'UEFA', 27, 1725, 0.69),
  ('team-pol', 'Poland', 'POL', 'PL', 'UEFA', 28, 1720, 0.68),
  ('team-aut', 'Austria', 'AUT', 'AT', 'UEFA', 29, 1715, 0.68),
  ('team-tur', 'Turkey', 'TUR', 'TR', 'UEFA', 30, 1710, 0.67),
  ('team-srb', 'Serbia', 'SRB', 'RS', 'UEFA', 31, 1705, 0.67),
  ('team-wal', 'Wales', 'WAL', 'GB', 'UEFA', 32, 1700, 0.66),
  ('team-gha', 'Ghana', 'GHA', 'GH', 'CAF', 33, 1695, 0.66),
  ('team-cmr', 'Cameroon', 'CMR', 'CM', 'CAF', 34, 1690, 0.65),
  ('team-cri', 'Costa Rica', 'CRI', 'CR', 'CONCACAF', 35, 1685, 0.65),
  ('team-tun', 'Tunisia', 'TUN', 'TN', 'CAF', 36, 1680, 0.64),
  ('team-qat', 'Qatar', 'QAT', 'QA', 'AFC', 37, 1675, 0.64),
  ('team-par', 'Paraguay', 'PAR', 'PY', 'CONMEBOL', 38, 1670, 0.63),
  ('team-egy', 'Egypt', 'EGY', 'EG', 'CAF', 39, 1665, 0.63),
  ('team-nga', 'Nigeria', 'NGA', 'NG', 'CAF', 40, 1660, 0.62);
