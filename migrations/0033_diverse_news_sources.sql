-- Register additional World Cup news RSS publishers (host nations, UEFA, LATAM, UK tabloids)

INSERT OR IGNORE INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, health_status)
VALUES
  ('src-rss-uefa-news', 'UEFA', 'rss', 'https://www.uefa.com/rssfeed/news/rss.xml', 0.84, 'news', 'healthy'),
  ('src-rss-ussoccer', 'U.S. Soccer', 'rss', 'https://www.ussoccer.com/rss.xml', 0.83, 'news', 'healthy'),
  ('src-rss-canada-soccer', 'Canada Soccer', 'rss', 'https://www.canadasoccer.com/feed', 0.81, 'news', 'healthy'),
  ('src-rss-athletic-soccer', 'The Athletic', 'rss', 'https://www.nytimes.com/athletic/rss/soccer/', 0.84, 'news', 'healthy'),
  ('src-rss-90min', '90min', 'rss', 'https://www.90min.com/posts.rss', 0.76, 'news', 'healthy'),
  ('src-rss-marca-futbol', 'MARCA', 'rss', 'https://www.marca.com/rss/futbol.xml', 0.79, 'news', 'healthy'),
  ('src-rss-football-italia', 'Football Italia', 'rss', 'https://www.football-italia.net/rss', 0.78, 'news', 'healthy'),
  ('src-rss-football-espana', 'Football Espana', 'rss', 'https://www.football-espana.net/feed', 0.77, 'news', 'healthy'),
  ('src-rss-cbs-soccer', 'CBS Sports', 'rss', 'https://www.cbssports.com/rss/headlines/soccer/', 0.79, 'news', 'healthy'),
  ('src-rss-mirror-football', 'Daily Mirror', 'rss', 'https://www.mirror.co.uk/sport/football/rss.xml', 0.74, 'news', 'healthy'),
  ('src-rss-espn-mx-soccer', 'ESPN', 'rss', 'https://www.espn.com.mx/espn/rss/soccer/news', 0.79, 'news', 'healthy'),
  ('src-rss-ole-argentina', 'Olé', 'rss', 'https://www.ole.com.ar/rss/', 0.77, 'news', 'healthy'),
  ('src-rss-independent-football', 'The Independent', 'rss', 'https://www.independent.co.uk/sport/football/rss', 0.78, 'news', 'healthy'),
  ('src-rss-standard-football', 'Evening Standard', 'rss', 'https://www.standard.co.uk/sport/football/rss', 0.76, 'news', 'healthy');
