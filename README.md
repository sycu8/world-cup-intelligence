# World Cup Intelligence (PitchIntel)

**PitchIntel** — nền tảng phân tích chiến thuật & xác suất cho **FIFA World Cup 2026**, chạy trên Cloudflare Workers.

🌐 **Production:** [wcstat.orangecloud.vn](https://wcstat.orangecloud.vn) · [Workers URL](https://wc-tactical-probability-platform.sycu-lee.workers.dev)

---

## Tính năng chính

### Trang chủ (`/`)
- Trận nổi bật (featured match) + xác suất real-time
- Lịch thi đấu rút gọn, tin nóng, snapshot giải (scheduled / live / completed)
- Song ngữ **Tiếng Việt / English** (toàn site)
- Tin nóng tự dịch VI; làm mới mỗi 30 giây

### Trận đấu (`/matches`)
- Lịch đầy đủ **104 trận** WC 2026 (vòng bảng + knockout)
- Tỉ số **LIVE** và **FT** trên lịch, làm mới mỗi 30 giây
- Lọc: tất cả / vòng bảng / knockout

### Pipeline sau trận (backend)
Sau mỗi trận kết thúc (cron mỗi phút):
1. Cập nhật tỉ số & `status = completed` trên D1
2. **Tiến vòng knockout** — đội thắng vào R16 → Tứ kết → Bán kết → Chung kết / tranh hạng 3
3. **Xếp hạng bảng** — khi hết 6 trận/bảng, top 2 vào Vòng 1/16 (bảng A–L)
4. **Tính lại xác suất** toàn bộ 104 trận (`recomputeAllWc2026Matches`)

> Hiện dùng mock ingest (tỉ số theo thời gian kickoff). Sẵn sàng thay bằng API dữ liệu thật trong `src/ingestion/matchDataRefresh.ts`.

### Chi tiết trận (`/matches/:matchId`)
- **Xác suất real-time** — poll 30s (15s khi LIVE): tỉ lệ thắng/hòa/thua, xG, độ tin cậy
- Panel xác suất hiển thị **tên đội** (không còn Chủ nhà/Khách), badge LIVE khi trận đang diễn ra
- **Đội hình** — badge **Chính thức / Dự kiến / Từ danh sách đội**; trang riêng `/lineups/:matchId`
- **Cơ cấu đóng góp đội** — section riêng full-width, nhãn đầy đủ (Ép sân, Kiến tạo, …), đặt trên lịch sử đối đầu
- **Đối đầu World Cup** — các trận giữa hai đội ở các kỳ WC trước 2026, kèm tỉ số & vòng đấu
- Team system, kịch bản (scenarios), mô hình vs thị trường (ẩn khi không có odds)
- Preview AI, tactical briefing, biến động xác suất theo thời gian
- **Mobile:** header tỉ số không còn sticky — cuộn xuống đọc được toàn bộ nội dung

### Đội hình chính thức → trận đấu (backend)
Cron mỗi phút (`refresh_minute`) và admin API:
1. Đọc **squad chính thức** (`squads.is_official = 1`, ≥ 7 cầu thủ)
2. Ghi `lineups` + `lineup_players` cho các trận WC 2026 sắp diễn ra (14 ngày tới)
3. Không ghi đè XI **match-day** đã xác nhận (`source_type = match_official`)
4. **Recompute** xác suất cho các trận bị ảnh hưởng; engine dùng `homeLineup` / `awayLineup`

> Squad seed hiện chỉ có vài cầu thủ/đội — cần mở rộng squad hoặc nhập XI qua admin để thấy badge **Chính thức** trên web.

### Phân tích dài (`/matches/:matchId/analysis`)
- Tiêu đề trận bằng **tên đội thật** (vd. *United States vs Argentina*), kèm ngày kickoff
- Xác suất, hệ thống đội, kịch bản, thị trường, lịch sử đối đầu WC — cập nhật real-time

### Bài viết / News Intelligence (`/news-intelligence`)
- RSS từ **BBC**, **The Guardian**, **FIFA**, **Reuters**, **AP**, **Sky Sports** (crawl mỗi 15 phút)
- Danh sách tin + thẻ nóng
- **Mỗi bài một trang riêng** (`/news-intelligence/:articleId`)
- Nút **Tiếng Việt | English** trên từng bài (dịch AI: m2m100 + gateway, lưu D1)
- Link *Đọc chi tiết tại nguồn* mở bài gốc

### Hướng dẫn (`/guide`)
- Giải thích cách đọc xác suất, kịch bản, disclaimer thị trường

### Đội / Cầu thủ
- `/teams/:teamId` — hồ sơ đội + **tổng hợp đối đầu World Cup** theo từng đối thủ (W/D/L, tỉ số từng trận)
- `/players/:playerId` — thông tin cầu thủ
- `/lineups/:matchId` — đội hình trận

## Agent & crawler discovery

| URL | Mô tả |
|-----|--------|
| `/robots.txt` | RFC 9309 — AI bot rules, Content-Signal, sitemap |
| `/sitemap.xml` | Sitemap (trang tĩnh + 104 trận + phân tích) |
| `/.well-known/api-catalog` | RFC 9727 `application/linkset+json` |
| `/.well-known/openapi.json` | OpenAPI 3.1 |
| `/docs/api` | API documentation (Markdown) |
| `/auth.md` | Agent auth policy (public GET, admin token) |
| `/.well-known/oauth-protected-resource` | RFC 9727 PRM — `/api/admin` + authorization server |
| `/.well-known/oauth-authorization-server` | RFC 8414 + `agent_auth` (auth.md registration) |
| `/.well-known/openid-configuration` | OpenID Connect discovery |
| `/.well-known/jwks.json` | JWKS document |
| `/.well-known/dns-aid.json` | DNS-AID SVCB/HTTPS template (publish in DNS) |
| `GET /api/admin/agents/register` | Agent registration metadata (no auto-provisioning) |
| `/.well-known/mcp/server-card.json` | MCP server card (REST-first) |
| `/.well-known/agent-skills/index.json` | Agent skills discovery index |

Homepage trả `Link` headers (RFC 8288) qua Worker + `_headers` — api-catalog, OpenAPI, docs, auth.md, PRM, sitemap. Client đăng ký **WebMCP** tools khi trình duyệt hỗ trợ.

> **DNS-AID:** Worker phục vụ template tại `/.well-known/dns-aid.json`. Để scanner pass, publish bản ghi `_index._agents.wcstat.orangecloud.vn` (HTTPS/SVCB) trên **Cloudflare DNS** zone `orangecloud.vn` và bật **DNSSEC**.

---

| Lớp | Vai trò |
|-----|---------|
| **Data Truth** | D1, R2 raw, provenance nguồn |
| **Probability** | Engine Poisson/Dixon-Coles — số liệu do engine, không do AI |
| **Intelligence** | Cloudflare AI Gateway + OpenAI — chỉ giải thích / tóm tắt |

---

## Kiến trúc

```
Cron (* * * * *) ──► INGEST_QUEUE ──► officialLineupSync (squad → trận)
                                      ├── matchDataRefresh (live + FT)
                                      ├── tournamentProgression
                                      └── bulk recompute (KV flag / 104 trận)

Cron (*/15 * * * *) ──► crawl_news ──► RSS (6 nguồn) ──► D1 + dịch VI

Cron (0 3 * * 1) ──► StatsBomb open-data pull (WC 2018/2022)

React SPA (Vite) ──► Hono API on Workers ──► D1 / KV / R2 / Queues / AI
                      └── useMatchLiveData (poll 15–30s)
```

**Stack:** Cloudflare Workers, D1, KV, R2, Queues, Durable Objects, Workers AI, Vite + React 19, Tailwind, Hono, TypeScript.

---

## Quick start

```bash
git clone https://github.com/sycu8/world-cup-intelligence.git
cd world-cup-intelligence
npm install
npm run db:migrate:local
npm run seed
npm test
npm run dev
```

Worker + D1 local:

```bash
npx wrangler dev
```

Worker + D1 remote (cần mạng ổn định tới Cloudflare):

```bash
npx wrangler dev --remote --port 8787
```

---

## Scripts

| Script | Mô tả |
|--------|--------|
| `npm run dev` | Frontend Vite |
| `npm run build` | Build production |
| `npm run test` | Vitest (66 tests) |
| `npm run pull:statsbomb` | Pull StatsBomb open-data → D1 + R2 |
| `npm run typecheck` | TypeScript |
| `npm run deploy` | Build + `wrangler deploy` |
| `npm run db:migrate:local` | Migration D1 local |
| `npm run db:migrate:remote` | Migration D1 production |

---

## Cấu hình Cloudflare

1. Tạo D1, R2, KV, Queues (xem `wrangler.jsonc`)
2. Apply migrations: `npm run db:migrate:remote`
3. Secrets:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ADMIN_TOKEN   # bắt buộc cho POST /api/admin trên production
```

`ADMIN_TOKEN` **không có sẵn** — bạn tự đặt chuỗi bí mật khi chạy lệnh trên. Dùng cùng giá trị làm header:

```bash
curl -X POST https://wcstat.orangecloud.vn/api/admin/lineups/sync-squads \
  -H "X-Admin-Token: <ADMIN_TOKEN>"
```

Local dev: đặt `ADMIN_TOKEN` trong `.dev.vars` (xem `.env.example`). Nếu không set token trong `development`, POST admin vẫn mở.

4. Deploy: `npm run deploy`

Chi tiết AI Gateway: xem [BRANDING.md](./BRANDING.md). Chính sách agent: [auth.md](https://wcstat.orangecloud.vn/auth.md).

---

## API (public)

| Endpoint | Mô tả |
|----------|--------|
| `GET /api/health` | Health + meta refresh |
| `GET /api/dashboard` | Featured match, counts |
| `GET /api/schedule` | Lịch 104 trận theo ngày |
| `GET /api/matches/:id` | Chi tiết trận |
| `GET /api/matches/:id/lineups` | Đội hình hai bên (official / projected / squad) |
| `GET /api/matches/:id/preview` | Phân tích trước trận (lineup, form, bảng) |
| `GET /api/matches/:id/probability` | Snapshot xác suất |
| `GET /api/matches/:id/history` | Đối đầu WC (`worldCupHistory`, `worldCupSummary`) |
| `GET /api/matches/:id/tactical-briefing` | Briefing AI |
| `GET /api/matches/:id/scenarios` | Kịch bản |
| `GET /api/matches/:id/probability-movement` | Lịch sử biến động xác suất |
| `GET /api/teams/:id/wc-h2h` | Lịch sử WC của đội theo đối thủ |
| `GET /api/news` | Danh sách tin (paginate, hot) |
| `GET /api/news/:docId` | Một bài (+ dịch VI on-demand) |
| `GET /api/analysis/:matchId` | Phân tích đa biến |

**Admin** (cần header `X-Admin-Token` = secret `ADMIN_TOKEN`):

| Endpoint | Mô tả |
|----------|--------|
| `POST /api/admin/recompute-all` | Recompute toàn bộ 104 trận WC 2026 |
| `POST /api/admin/recompute/:matchId` | Recompute một trận (queue) |
| `POST /api/admin/lineups/sync-squads` | Đồng bộ squad chính thức → trận sắp đá |
| `POST /api/admin/matches/:matchId/lineup` | Nhập XI chính thức (≥ 7 cầu thủ) |
| `POST /api/admin/ingest` | Queue bulk ingest (StatsBomb + news) |
| `GET /api/admin/sources` | Health nguồn dữ liệu (public GET) |

---

## Kiểm tra chất lượng

```bash
npm run typecheck   # ✓ pass
npm test            # ✓ 66 tests, 21 files
```

**Đã kiểm tra:**
- Xác suất & snapshot engine
- Dịch tin tức (VI detection, backfill, m2m100)
- RSS images & publishers (6 feeds)
- Post-match lifecycle & xếp hạng bảng
- Lịch sử đối đầu World Cup (grouping, summary)
- Market calculations, scoreline, safety copy
- Team form stats, StatsBomb ingest, bulk recompute runner
- Official lineup sync, lineup features cho probability engine

---

## Cấu trúc thư mục

```
app/           React UI (pages, components, i18n)
  lib/         useMatchLiveData, matchTeams, api
src/
  routes/      Hono API
  services/    recompute, progression, matchHistory, officialLineupSync, teamFormStats
  ingestion/   match refresh, news crawler, statsbombIngest
  models/      probability engine
  queues/      ingest + model consumers
  scheduled/   cron
migrations/    D1 SQL (0001–0016)
scripts/       pull-statsbomb-open-data.mjs
tests/         Vitest
```

---

## Dữ liệu lịch sử World Cup

Migration `0013_wc_historical_h2h.sql` seed các kỳ WC (1930–2022) và trận đối đầu giữa 6 đội tham chiếu (ARG, FRA, BRA, ENG, USA, MEX). Có thể mở rộng thêm đội/trận khi cần.

---

## Dữ liệu & pháp lý

- Không scrape nguồn không kiểm soát
- Chỉ RSS/API có giấy phép hoặc open data (StatsBomb open-data, OpenFootball CC0)
- Raw payload lưu R2 trước khi normalize D1
- Ghi chú license trong `source_registry`

---

## Roadmap

- [x] StatsBomb open-data ingest (WC 2018/2022) → form stats + team ratings
- [x] Auto bulk recompute WC 2026 khi có data mới (StatsBomb, trận kết thúc, cron fallback)
- [x] Đồng bộ đội hình chính thức (squad / admin XI) lên từng trận + ảnh hưởng engine
- [ ] Mở rộng squad WC 2026 đủ 23 cầu thủ/đội (hiện seed thưa)
- [ ] API dữ liệu trận thật (FIFA / partner feed) thay mock ingest
- [ ] 8 suất hạng 3 tốt nhất → R32 trận 13–16
- [ ] Bracket visualization UI
- [ ] Bảng xếp hạng vòng bảng trên web
- [ ] Mở rộng seed lịch sử WC cho 48 đội WC 2026

---

## License

MIT — xem repository owner để biết chi tiết.

## Liên hệ

Repository: [github.com/sycu8/world-cup-intelligence](https://github.com/sycu8/world-cup-intelligence)
