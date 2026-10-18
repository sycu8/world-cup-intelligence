-- Register additional global soccer RSS publishers for the blog/news feed.

INSERT OR IGNORE INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, health_status)
VALUES
  ('src-rss-guardian-football', 'The Guardian Football', 'rss', 'https://www.theguardian.com/football/rss', 0.84, 'news', 'unknown'),
  ('src-rss-vnexpress-thethao', 'VnExpress Thể thao', 'rss', 'https://vnexpress.net/rss/the-thao.rss', 0.78, 'news', 'unknown'),
  ('src-rss-afc-news', 'Asian Football Confederation', 'rss', 'https://www.the-afc.com/en/more/news.html', 0.8, 'news', 'unknown');
