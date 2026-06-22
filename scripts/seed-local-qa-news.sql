-- Sanitized mock news for local QA only (run via scripts/bootstrap-local-qa-data.sh)
INSERT OR IGNORE INTO source_registry (id, source_name, source_type, base_url, reliability_score, allowed_usage, health_status)
VALUES ('src-rss-guardian-wc', 'The Guardian', 'rss', 'https://example.com/news', 0.82, 'news', 'healthy');

INSERT OR IGNORE INTO source_documents (
  id, source_id, source_url, title, title_vi, published_at, retrieved_at,
  summary, summary_vi, reliability_score, content_r2_key, hot_score
) VALUES
  ('doc-qa-001', 'src-rss-guardian-wc', 'https://example.com/qa/001', 'Mexico open World Cup 2026 with South Africa test', 'Mexico mở World Cup 2026 trước Nam Phi', datetime('now'), datetime('now'), 'Group A opener in Mexico City.', 'Trận mở màn bảng A tại Mexico City.', 0.82, 'news/qa/001.json', 0.9),
  ('doc-qa-002', 'src-rss-guardian-wc', 'https://example.com/qa/002', 'USMNT squad depth key for knockout push', 'Chiều sâu USMNT cho vòng knock-out', datetime('now'), datetime('now'), 'USA rotation across host cities.', 'Luân chuyển Mỹ tại các thành phố chủ nhà.', 0.82, 'news/qa/002.json', 0.85),
  ('doc-qa-003', 'src-rss-guardian-wc', 'https://example.com/qa/003', 'Portugal lean on midfield control in Group K', 'Bồ Đào Nha kiểm soát giữa sân bảng K', datetime('now'), datetime('now'), 'Tactical preview Portugal vs Colombia.', 'Phân tích Bồ Đào Nha gặp Colombia.', 0.82, 'news/qa/003.json', 0.8),
  ('doc-qa-004', 'src-rss-guardian-wc', 'https://example.com/qa/004', 'Canada aim to ride home support in Vancouver', 'Canada tận dụng sân nhà Vancouver', datetime('now'), datetime('now'), 'CanMNT targeting group points.', 'CanMNT nhắm điểm vòng bảng.', 0.82, 'news/qa/004.json', 0.78),
  ('doc-qa-005', 'src-rss-guardian-wc', 'https://example.com/qa/005', 'VAR transparency debate returns ahead of 2026', 'Tranh luận VAR trước World Cup 2026', datetime('now'), datetime('now'), 'FIFA pressure on review images.', 'Áp lực công bố hình ảnh VAR.', 0.82, 'news/qa/005.json', 0.77),
  ('doc-qa-006', 'src-rss-guardian-wc', 'https://example.com/qa/006', 'Brazil injury update shakes pre-tournament odds', 'Chấn thương Brazil làm rung tỷ lệ', datetime('now'), datetime('now'), 'Seleção fitness watch.', 'Theo dõi thể lực Seleção.', 0.82, 'news/qa/006.json', 0.76),
  ('doc-qa-007', 'src-rss-guardian-wc', 'https://example.com/qa/007', 'England experiment with inverted full-backs', 'Anh thử hậu vệ cánh lùi', datetime('now'), datetime('now'), 'Three Lions tactical shift.', 'Thay đổi chiến thuật Tam Sư.', 0.82, 'news/qa/007.json', 0.75),
  ('doc-qa-008', 'src-rss-guardian-wc', 'https://example.com/qa/008', 'Knockout bracket paths narrow after Group L', 'Nhánh knock-out thu hẹp sau bảng L', datetime('now'), datetime('now'), 'Round of 32 seeding update.', 'Cập nhật seeding vòng 32.', 0.82, 'news/qa/008.json', 0.74);
