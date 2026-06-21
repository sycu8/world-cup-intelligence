# Roadmap execution plan

Cycle per item: **Plan → Code+Test → Feedback → Supplement → Deploy → Test+Fix+Redeploy**

**Production:** [wcstat.orangecloud.vn](https://wcstat.orangecloud.vn) · Verify deploy via Cloudflare Dashboard or `GET /api/health`.

| ID | Item | Phase | Status |
|----|------|-------|--------|
| R1 | WebSocket scenario live refresh | 1 | ✅ Done |
| R7 | Group standings API + UI | 1 | ✅ Done |
| R5 | 8 best 3rd → R32 13–16 | 2 | ✅ Done |
| R6 | Bracket visualization UI | 2 | ✅ Done |
| R3 | Squad 23 players/team | 3 | ⚠️ 42 team names (0018); players pending |
| R8 | Historical WC seed 48 teams | 3 | ✅ Names + ISO (0018/0019); H2H via StatsBomb |
| R2 | Scenario backtest 2018/2022 | 4 | ✅ Done |
| R4 | Real match data adapter | 4 | ✅ FIFA Match Centre + mock fallback |
| R9 | Full EN/VI i18n + scenario VI copy | 5 | ✅ Done |
| R10 | ISO country codes fix (0019) | 5 | ✅ Done |
| R11 | FIFA kickoff UTC + results (0031/0032) | 6 | ✅ Done |
| R12 | Public API v1 (feed, webhooks, SSE) | 6 | ✅ Done (0030) |
| R13 | Capability scenario suite (22 checks) | 6 | ✅ Done |
| R14 | FIFA lineup pre-kickoff sync | 6 | ✅ Done |
| R15 | CI migrations before deploy | 6 | ✅ Done |

---

## R11 — FIFA kickoff & results from Match Centre

**Plan**
- Replace VN-only kickoff source with FIFA Match Centre API for all 104 fixtures
- `scripts/wc2026-fifa-kickoffs.json` + migration `0031_fifa_kickoff_times.sql`
- Backfill completed FT scores: `0032_fifa_completed_results.sql`
- `npm run sync:fifa-schedule` to regenerate from live FIFA calendar

**Acceptance**
- `kickoffUtcForFifaNumber(1..104)` without error (`wc2026VnKickoffs.test.ts`)
- Production matches have `fifa_match_id` aligned with JSON
- Scenario S04–S08 pass

---

## R12 — Public API v1

**Plan**
- `GET /api/v1/feed`, `/matches`, `/matches/:ref/snapshot`, `/stream`
- Webhooks with HMAC signing; admin `POST /api/admin/api-clients`
- `PUBLIC_API_REQUIRE_KEY=true` on production

**Acceptance**
- Unauthenticated `/api/v1/matches` → 401 on production
- Docs in `app/lib/apiDocsContent.ts` + `/docs/api`

---

## R13 — Capability scenario suite

**Plan**
- 22 pass/fail scenarios covering health, schedule, FIFA, probability, stats, scenarios, news, discovery, Public API, SPA, unit tests, typecheck
- `npm run test:scenarios` → `reports/capability-scenarios.json`

**Acceptance**
- 22/22 PASS against production (see `docs/CAPABILITY_SCENARIOS.md`)

---

## R14 — FIFA lineup pre-kickoff

**Plan**
- `shouldSyncFifaLineupForKickoff` — from 10 min before kickoff through live
- `syncFifaLineupsForUpcomingMatches` in minute cron
- Official XI via `applyOfficialLineupToMatch` when FIFA match sheet has 11 starters

**Acceptance**
- `tests/fifaLineupSync.test.ts` pass; scenario S22 pass

---

## R15 — CI migrations before deploy

**Plan**
- `.github/workflows/deploy.yml`: `db:migrate:uat` / `db:migrate:production` before respective deploy steps

---

## R1 — WebSocket scenario live refresh

**Plan**
- Hook `useMatchScenarioLive(matchRef, onUpdate)` → `wss://…/api/matches/:ref/live`
- Parse `SCENARIO_UPDATE` → update `scenarioPredictions` state in MatchPage / MatchAnalysisPage
- Fallback: existing REST on mount; WS for push updates
- Vite proxy: `ws: true` for local dev

**Acceptance**
- Panel updates without full page reload when admin triggers scenario recompute
- Connection closes on unmount; no duplicate sockets

---

## R7 — Group standings on web

**Plan**
- `GET /api/tournaments/2026/standings` — 12 groups, team names, P/W/D/L/GF/GA/GD/Pts
- Tab **Bảng xếp hạng** on `/matches` + poll 30s
- Reuse `computeGroupStandings` from `tournamentProgression.ts`

---

## R5 — 8 best 3rd place → R32 13–16

**Plan**
- When all 12 groups complete: rank 12 third-place teams (Pts, GD, GF)
- Top 8 → slots on `m-w26-r32-13` … `m-w26-r32-16` (2 per match)
- Constants for slot mapping; tests for ranking + assignment

---

## R6 — Bracket visualization UI

**Plan**
- `GET /api/tournaments/2026/bracket` — tree from `match_bracket_links` + match rows + slugs
- Tab **Nhánh đấu** on `/matches` — R32 → Final, link to match slug

---

## R3 — Squad 23/team

**Plan**
- Migration/script: expand `squads` + `squad_players` for 48 WC 2026 teams (OpenFootball/StatsBomb names)
- Admin verify: `sync-squads` populates upcoming matches

**Status**
- ✅ Migration `0018` renames 42 placeholder teams to real nations
- ⏳ Full 23-player squads per team not seeded yet

---

## R8 — Historical seed 48 teams

**Plan**
- Replace `team-w26-*` placeholders with real nation rows where possible
- Expand `0013`-style H2H via StatsBomb ingest script for all 48 team IDs

**Status**
- ✅ Team names in D1 (0018)
- ✅ ISO 3166-1 alpha-2 codes (0019 + `scripts/nationIsoCodes.mjs`)
- Ongoing: H2H expansion via StatsBomb pull

---

## R2 — Scenario backtest

**Plan**
- Implement `runScenarioBacktest`: replay WC 2018/2022 completed matches
- Metrics: Brier, calibration buckets → R2 + `model_runs`
- Admin `POST /api/admin/scenario-backtest`

---

## R4 — Real match data

**Plan**
- `MatchDataProvider` interface; `MockMatchDataProvider` + FIFA `syncFifaWc2026Matches`
- Production: `FIFA_LIVE_ENABLED=true` → FIFA Match Centre; mock when disabled

---

## R9 — Full EN/VI i18n

**Plan**
- Centralize UI strings in `app/lib/i18n/locales.ts` (VI default, EN toggle on header)
- Stage/group labels in `stageLabels.ts` (*Bảng A*, *Vòng 1/16*, *gặp* vs *vs*)
- Localize scenario panel backend copy in `scenarioPredictionLabels.ts` (*Xác suất kịch bản*, drivers, comparison)

**Delivered**
- All main routes and panels; tests `scenarioPredictionLabels.test.ts`

---

## R10 — ISO country codes

**Problem**
- `expand-wc2026-data.mjs` used `nation.slice(0,2)` → invalid codes (`UN`, `ME`, duplicate `CA`, `SE`, …)

**Fix**
- `scripts/nationIsoCodes.mjs` — explicit ISO 3166-1 alpha-2 map
- Corrected `0018_wc2026_teams_squads.sql`
- `0019_fix_wc2026_country_codes.sql` applied on remote D1
- Tests: `tests/nationIsoCodes.test.ts`

---

## Next (suggested)

| Item | Notes |
|------|--------|
| Squad 23/team | Seed `squad_players` for all 48 teams |
| Vietnamese team names | Optional display layer separate from DB English names |
