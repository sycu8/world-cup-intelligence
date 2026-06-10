# Môi trường UAT — PitchIntel

## Chính sách triển khai

- **Mặc định** (`npm run deploy`) chỉ deploy lên **UAT**.
- **Production** (`npm run deploy:production`) chỉ chạy sau khi bạn xác nhận UAT đạt.
- UAT dùng **D1, KV, R2, Queues riêng** — không dùng chung production.

## URL

| Môi trường | Địa chỉ |
|------------|---------|
| UAT | `https://wc-tactical-uat.sycu-lee.workers.dev` |
| Production | `https://wcstat.orangecloud.vn` (không đổi khi chỉ deploy UAT) |

## Cloudflare Access (chặn UAT)

Chỉ cho phép `sycu.lee@gmail.com`:

1. Cloudflare Dashboard → **Zero Trust** → **Access** → **Applications**
2. **Add application** → Self-hosted
3. Domain: `wc-tactical-uat.sycu-lee.workers.dev` (hoặc `uat.wcstat.orangecloud.vn`)
4. Policy: **Allow** → Email → `sycu.lee@gmail.com`
5. Lưu và thử trên cửa sổ ẩn danh

## Lệnh thường dùng

```bash
npm run typecheck
npm run test
npm run build
npm run db:migrate:uat      # migration D1 UAT
npm run deploy:uat          # deploy Worker + assets lên UAT
npm run deploy:production   # production — chỉ sau khi UAT pass
```

## Checklist nghiệm thu UAT

- [ ] Trang UAT mở được (đăng nhập Access nếu đã bật)
- [ ] Production `wcstat.orangecloud.vn` không đổi
- [ ] `/api/health` trả `environment: uat`
- [ ] Trang trận: tab mobile, thanh tỉ số dính, nhãn tiếng Việt
- [ ] `/api/matches/{slug}/stats` trả JSON hoặc trạng thái trống rõ ràng
- [ ] `/api/matches/{slug}/probability` có `updatedAt`, `topScorelines`
- [ ] Trang SEO (`/lich-thi-dau-world-cup-2026`, …) hiển thị đúng
- [ ] `/sitemap.xml` có đường dẫn SEO
- [ ] Chuyển Tiếng Việt / English trên tin vẫn hoạt động

## Bindings UAT

| Binding | Tài nguyên |
|---------|------------|
| D1 `DB` | `wc-tactical-db-uat` (`956310d8-5ca1-49db-b188-7d0b435109ce`) |
| KV `KV` | `413d9f3be91046c883fb42fc5c99b0d7` |
| R2 | `wc-tactical-*-uat` |
| Queues | `wc-*-queue-uat` |
