# Môi trường UAT — PitchIntel

## Chính sách triển khai

- **Mặc định** (`npm run deploy`) chỉ deploy lên **UAT**.
- **Production** (`npm run deploy:production`) chỉ chạy sau khi bạn xác nhận UAT đạt.
- UAT dùng **D1, KV, R2, Queues riêng** — không dùng chung production.
- **GitHub Actions** (workflow `Deploy Cloudflare`): chọn target `uat` hoặc `production` — migrations D1 chạy **trước** deploy.

## URL

| Môi trường | Địa chỉ |
|------------|---------|
| UAT | `https://wc-tactical-uat.sycu-lee.workers.dev` |
| Production | `https://wcstat.orangecloud.vn` (không đổi khi chỉ deploy UAT) |

## Cloudflare Access (chặn UAT)

Chỉ cho phép email admin (thay `<your-email>` bằng địa chỉ thật — không commit email vào repo):

1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications**
2. **Add application** → Self-hosted
3. Domain: `wc-tactical-uat.sycu-lee.workers.dev` (hoặc `uat.wcstat.orangecloud.vn`)
4. Policy: **Allow** → Email → `<your-email>`
5. Lưu và thử trên cửa sổ ẩn danh

## Lệnh thường dùng

**Deploy auth:** tạo file `cf-deploy.token` (gitignored) với Cloudflare API token — không đặt trong `.env` / `.dev.vars`.

```bash
npm run typecheck
npm test
npm run test:scenarios    # 22 capability checks (default: production URL)
BASE_URL=https://wc-tactical-uat.sycu-lee.workers.dev npm run test:scenarios
npm run build
npm run db:migrate:uat      # migration D1 UAT
npm run deploy:uat          # deploy Worker + assets lên UAT
npm run db:migrate:production
npm run deploy:production   # production — chỉ sau khi UAT pass
```

## Checklist nghiệm thu UAT

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
