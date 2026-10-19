-- Prod wc-tactical-db on 2026-10-18: 28,469 source_documents, 28,153 distinct
-- source_url values, 0 blanks, 129 URLs duplicated (316 extra rows, max 25 copies).
-- A UNIQUE index would fail to build. publishNewsArticle looks up
-- SELECT id FROM source_documents WHERE source_url = ? and stops at the first row,
-- so a non-unique index is enough and stops the full scan.

CREATE INDEX IF NOT EXISTS idx_source_documents_source_url ON source_documents(source_url);
