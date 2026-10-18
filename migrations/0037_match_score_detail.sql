-- Per-period score breakdown (halves, stoppage, extra time, penalties)
ALTER TABLE matches ADD COLUMN score_detail_json TEXT;

-- Mexico 2-0 South Africa opener (from official match events)
UPDATE matches SET score_detail_json = '{"ht":{"home":1,"away":0},"secondHalf":{"home":1,"away":0},"ft90":{"home":2,"away":0},"stoppage":{"secondHalf":2}}'
WHERE id = 'm-w26-ga-1v2';
