-- VnExpress World Cup 2026 news listing (HTML crawl)

INSERT OR IGNORE INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, license_notes, health_status)
VALUES
  (
    'src-rss-vnexpress-wc2026',
    'VnExpress World Cup 2026',
    'html',
    'https://vnexpress.net/the-thao/world-cup-2026/tin-tuc',
    0.78,
    'news',
    'VnExpress sports section — public listing page',
    'healthy'
  );
