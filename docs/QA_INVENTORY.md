# QA inventory — PitchIntel (World Cup 2026)

Full user-facing inventory with acceptance criteria and risk-based edge cases. Automated checks: `npm run test:qa-local` (local Worker) or production capability suite `npm run test:scenarios`.

## Roles

| Role | Auth | Surfaces |
|------|------|----------|
| **Public reader** | None | All SPA routes, `GET /api/*` product APIs |
| **Admin operator** | `X-Admin-Token` | `POST /api/admin/*` (ingest, recompute, crawl) |
| **Partner API** | `X-API-Key` | `GET /api/v1/*` (production requires key) |

No end-user login. Favorites use `localStorage` only (`wc-favorites-v1`).

## Local production-like setup

```bash
cp .env.example .dev.vars   # ENVIRONMENT=development, ADMIN_TOKEN=qa-local-dev
npm run db:migrate:local
npm run bootstrap:local-qa  # needs wrangler dev on :8790
npx wrangler dev --local --port 8790 --ip 127.0.0.1
BASE_URL=http://127.0.0.1:8790 npm run test:qa-local
```

Sanitized data: 104 matches from migrations, 8 mock news rows (`example.com`), no PII, no production secrets.

---

## Global shell

| Feature | Route / control | Acceptance criteria | Edge cases |
|---------|-----------------|---------------------|------------|
| VI/EN toggle | Header `LangSwitch` | Copy switches; persists in session | Missing translation key falls back to EN |
| Top navigation | All shell pages | Links resolve; active state correct | `/tournaments` → `/matches?tab=standings` |
| Mobile bottom nav | `< md` | Home, Matches, News, Guide reachable | Safe-area padding on iOS |
| Footer | All shell pages | Renders without layout shift | — |
| Loading fallback | Lazy routes | `aria-busy` skeleton while chunk loads | Slow network shows fallback ≥1s |

---

## Home `/`

| Feature | Acceptance criteria | Edge cases |
|---------|---------------------|------------|
| Group/knockout board | 12 groups A–L; knockout tabs; W/D/L or «Chưa có» | Empty probabilities show placeholder, not crash |
| Countdown | Target date WC 2026 kickoff | Past date shows 0 or “live” state |
| Champion odds | Top teams + %; Monte Carlo label | Missing cache returns loading then data |
| Prediction accuracy | Completed match metrics when data exists | Zero completed → empty state |
| Featured match | Live or next kickoff with prob strip | No upcoming → null hero |
| Hot news preview | ≥3 items link to `/news-intelligence/:id` | Zero news → section hidden |
| Auto-refresh | 30s poll `/api/home` | Tab backgrounded still recovers |

---

## Matches hub `/matches`

| Tab | Controls | Acceptance criteria | Edge cases |
|-----|----------|---------------------|------------|
| **Schedule** | Search, stage/status/day filters, grid/list, favorites star, calendar export | 104 matches; filters narrow list; `.ics` download valid | Favorites-only with none → empty state |
| **Standings** | Same board as home | 12 groups + third-place ranking | Incomplete groups show partial table |
| **Favorites** | Starred matches + teams | Reads/writes localStorage | Corrupt JSON → reset gracefully |
| **Teams** | Directory links to `/teams/:id` | All WC teams listed | — |
| **URL state** | `?tab=standings` etc. | Deep-link opens correct tab; back button works | Invalid `?tab=` → schedule default |

---

## Match detail `/matches/:matchId`

| Section | Acceptance criteria | Edge cases |
|---------|---------------------|------------|
| Slug + legacy ID | `vong-bang-a-mexico-vs-south-africa` ≡ `m-w26-ga-1v2` | Unknown slug → 404 page |
| View modes | Tactical ↔ Editorial toggle | — |
| Probability | W+D+L ≈ 1; `wc-prob-v5`; scoreline matrix | Missing snapshot → gap-fill or «Chưa có» |
| Live stats | 15s poll when `status=live` | Pre-match stats unavailable message |
| Scenarios | ≥1 scenario incl. baseline | AI/R2 failure → DB scenarios still show |
| Analyst sliders | Adjust displayed edge/tempo | Does not persist to server |
| Section nav | Scroll-spy overview/stats/prediction/… | Short viewport still scrolls |
| Polling | 10s live / 30s scheduled | Network error → last good data |

---

## Analysis `/matches/:id/analysis`

Long-form article: probabilities, H2H, preview, scenarios, market, briefing. **Pass:** 200 from `/api/analysis/:ref` sections render. **Edge:** AI gateway off → static sections only.

---

## Lineups `/lineups/:matchId`

Two-column XI when ≥7 official players. **Edge:** Future match → “lineup not available” without error.

---

## Teams `/teams/:teamId` · Players `/players/:playerId`

Squad, WC H2H, favorite toggle; player name/position/club. **Edge:** Unknown ID → 404.

---

## News `/news-intelligence` · `/news-intelligence/:id`

Paginated feed (8/page); hot strip (top 3–5, excluded from list by design). VI/EN per article. **Pass:** `hotCount + total ≥ 8` after seed. **Edge:** Missing R2 thumb → placeholder image.

---

## Guide `/guide` · API docs `/docs/api`

Static content renders; docs outside `AppShell`. **Edge:** Long guide scroll + anchor links work.

---

## SEO landing pages (8 paths)

Answer-first copy, CTA, canonical meta. **Pass:** HTML shell + `usePageMeta` title. Listed in `src/services/seoPages.ts`.

---

## Automated local checks (L01–L14)

| ID | Area |
|----|------|
| L01 | Health |
| L02 | Schedule 104 |
| L03 | Home bundle |
| L04 | Slug + legacy match |
| L05 | Match endpoints + probability |
| L06 | Scenarios + market |
| L07 | Tournament aggregates |
| L08 | News (unique total ≥8) |
| L09 | Teams + players |
| L10 | Lineups + pitch + history |
| L11 | robots/sitemap/SPA |
| L12 | Public API (local key optional) |
| L13 | Admin token guard |
| L14 | 104 match probabilities |

Report: `reports/local-qa-inventory.json`

---

## Bug log (this run)

| ID | Severity | Issue | Fix |
|----|----------|-------|-----|
| BUG-001 | High | `npm run db:migrate:local` used wrong D1 name `wc-tactical-db` | → `wc-tactical-db-uat-v2` |
| BUG-002 | Medium | Nav “Tournaments” redirected to `/` (home) | → `/matches?tab=standings` + URL tab state |
| BUG-003 | Low | QA L08 counted list-only articles (hot excluded) | Runner uses `meta.total + hotCount` |

---

## Rerun gate

**Clean pass:** `npm test` + `npm run typecheck` + `BASE_URL=http://127.0.0.1:8790 npm run test:qa-local` all exit 0.

**Blocked handoff:** Wrangler OAuth required for remote D1 scripts; production scenario S01 requires `environment=production` — use read-only production audit only with explicit approval.
