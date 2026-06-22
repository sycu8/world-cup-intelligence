#!/usr/bin/env bash
# Bootstrap sanitized production-scale local data for QA.
# Prereq: wrangler dev running on port 8790 (or set BASE_URL).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BASE_URL="${BASE_URL:-http://127.0.0.1:8790}"
ADMIN_TOKEN="${ADMIN_TOKEN:-qa-local-dev}"

echo "==> Applying local D1 migrations"
npm run db:migrate:local

echo "==> Seeding QA news (sanitized)"
node scripts/wrangler-with-env.mjs d1 execute wc-tactical-db-uat-v2 --local --file=./scripts/seed-local-qa-news.sql

echo "==> Bulk recompute 104 WC 2026 matches"
curl -sf -X POST "$BASE_URL/api/admin/recompute-all" -H "X-Admin-Token: $ADMIN_TOKEN" | head -c 400
echo

echo "==> Done. Run: BASE_URL=$BASE_URL npm run test:qa-local"
