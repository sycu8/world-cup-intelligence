# Môi trường UAT — PitchIntel

## Chính sách triển khai

- **Mặc định** (`npm run deploy`) chỉ deploy lên **UAT**.
- **Production** (`npm run deploy:production`) chỉ chạy sau khi bạn xác nhận UAT đạt.
- UAT dùng **D1, KV, R2, Queues riêng** — không dùng chung production.
- **GitHub Actions** (workflow `Deploy Cloudflare`): chọn target `uat` hoặc `production` — migrations D1 chạy **trước** deploy.

## URL

| Môi trường | Địa chỉ |
|------------|---------|
| UAT | `https://wcstat-uat.orangecloud.vn` (Access) |
| Production | `https://wcstat.orangecloud.vn` (không đổi khi chỉ deploy UAT) |

## Cloudflare Access (chặn UAT)

Chỉ cho phép email admin (thay `<your-email>` bằng địa chỉ thật — không commit email vào repo):

1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications**
2. **Add application** → Self-hosted
3. Domain: `wcstat-uat.orangecloud.vn` (Workers domain behind Access). `workers.dev` is disabled.
4. Policy: **Allow** → Email → `<your-email>`
5. Lưu và thử trên cửa sổ ẩn danh

## Lệnh thường dùng

**Deploy auth:** tạo file `cf-deploy.token` (gitignored) với Cloudflare API token — không đặt trong `.env` / `.dev.vars`.

```bash
npm run typecheck
npm test
npm run test:scenarios    # 22 capability checks (default: production URL)
BASE_URL=https://wcstat-uat.orangecloud.vn npm run test:scenarios
npm run build
npm run db:migrate:uat      # migration D1 UAT
npm run deploy:uat          # deploy Worker + assets lên UAT
npm run db:migrate:production
npm run deploy:production   # production — chỉ sau khi UAT pass
```

The Access host answers with a login redirect unless the request carries a service token. Do not commit the token. For `npm run test:scenarios` against `https://wcstat-uat.orangecloud.vn`, export `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` in the shell for that run. The script sends them as `CF-Access-Client-Id` and `CF-Access-Client-Secret`.

## Recap queues before merge

Wrangler 4.151.1 exits 1 when a consumer names a queue that does not exist (`Queue "wc-recap-dlq-uat" does not exist`). The config needs four queues, not two:

```bash
npx wrangler queues create wc-recap-queue-uat
npx wrangler queues create wc-recap-dlq-uat
npx wrangler queues create wc-recap-queue
npx wrangler queues create wc-recap-dlq
```

Pre-merge checklist: all 4 queues exist (`npx wrangler queues list`) BEFORE merging, otherwise main's auto-deploy fails.

`.github/workflows/deploy.yml` applies D1 migrations, including `0043_pipeline_counters.sql` and `0044_recap_sync_claims.sql`, before the matching UAT or production deploy. The worker also creates those tables when they are missing, so either order is safe. The workflow does not create queues. Create the four queues separately, with the owner's OK, before merge.

## Checklist nghiệm thu UAT

- [ ] all 4 queues exist (`npx wrangler queues list`) BEFORE merging, otherwise main's auto-deploy fails

- [ ] Trang UAT mở được (đăng nhập Access nếu đã bật)
- [ ] Production `wcstat.orangecloud.vn` không đổi (khi chỉ deploy UAT)
- [ ] `/api/health` trả `environment: uat`
- [ ] `npm run test:scenarios` pass với `BASE_URL` UAT (điều chỉnh S01/S17 nếu UAT không bật API key)
- [ ] Trang trận: tab mobile, thanh tỉ số dính, nhãn tiếng Việt
- [ ] `/api/matches/{slug}/stats` trả JSON hoặc trạng thái trống rõ ràng
- [ ] `/api/matches/{slug}/probability` có `mostLikelyScore`, W/D/L
- [ ] Kickoff UTC khớp `scripts/wc2026-fifa-kickoffs.json` (sau migration `0031`)
- [ ] Trang SEO (`/lich-thi-dau-world-cup-2026`, …) hiển thị đúng
- [ ] `/sitemap.xml` có đường dẫn SEO
- [ ] Chuyển Tiếng Việt / English trên tin vẫn hoạt động

## Bindings UAT

| Binding | Tài nguyên |
|---------|------------|
| D1 `DB` | `wc-tactical-db-uat-v2` (ID trong `wrangler.jsonc`, không copy ra docs) |
| KV `KV` | namespace UAT (ID trong `wrangler.jsonc`) |
| R2 | `wc-tactical-*-uat` |
| Queues | `wc-*-queue-uat` |
