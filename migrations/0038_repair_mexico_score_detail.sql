-- Repair Mexico opener score detail + events after FIFA sync stripped stoppage/seed rows
UPDATE matches SET score_detail_json = '{"ht":{"home":1,"away":0},"secondHalf":{"home":1,"away":0},"ft90":{"home":2,"away":0},"stoppage":{"secondHalf":2}}'
WHERE id = 'm-w26-ga-1v2';

INSERT OR IGNORE INTO match_events (id, match_id, team_id, player_id, event_type, minute, period, outcome, xg, source_id)
VALUES
  ('ev-mexsa-g1', 'm-w26-ga-1v2', 'team-w26-a1', 'p-mex-quinones', 'goal', 9, '1H', 'scored', 0.32, 'src-fifa'),
  ('ev-mexsa-g2', 'm-w26-ga-1v2', 'team-w26-a1', 'p-mex-jimenez', 'goal', 67, '2H', 'scored', 0.41, 'src-fifa'),
  ('ev-mexsa-rc1', 'm-w26-ga-1v2', 'team-w26-a2', 'p-rsa-sithole', 'red_card', 49, '2H', 'denying_goal', NULL, 'src-fifa'),
  ('ev-mexsa-yc1', 'm-w26-ga-1v2', 'team-w26-a2', 'p-rsa-sibisi', 'yellow_card', 74, '2H', NULL, NULL, 'src-fifa'),
  ('ev-mexsa-rc2', 'm-w26-ga-1v2', 'team-w26-a2', 'p-rsa-zwane', 'red_card', 84, '2H', 'violent_conduct', NULL, 'src-fifa'),
  ('ev-mexsa-rc3', 'm-w26-ga-1v2', 'team-w26-a1', 'p-mex-montes', 'red_card', 92, '2H', 'denying_goal', NULL, 'src-fifa');
