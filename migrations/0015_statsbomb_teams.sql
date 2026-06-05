-- Teams referenced in StatsBomb WC 2006–2022 open-data pulls

INSERT OR IGNORE INTO teams (id, name, short_name, country_code, confederation, fifa_ranking, elo_rating, collective_strength_rating)
VALUES
  ('team-rus', 'Russia', 'RUS', 'RU', 'UEFA', 45, 1640, 0.60),
  ('team-isl', 'Iceland', 'ISL', 'IS', 'UEFA', 46, 1635, 0.59),
  ('team-pan', 'Panama', 'PAN', 'PA', 'CONCACAF', 47, 1630, 0.58),
  ('team-swe', 'Sweden', 'SWE', 'SE', 'UEFA', 48, 1625, 0.58),
  ('team-per', 'Peru', 'PER', 'PE', 'CONMEBOL', 49, 1620, 0.57);
