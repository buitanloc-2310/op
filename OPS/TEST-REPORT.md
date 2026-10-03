# OPS Test Report — 2026-10-03

## PASS trong môi trường build

- JavaScript syntax: PASS (`src/index.js`, `src/security.js`, `src/data.js`, `src/catalog.js`, `public/app.js`).
- OPS validator: 45/45 PASS.
- SQLite migration syntax: PASS trên SQLite local.
- 8 service definitions: PASS.
- 7 source D1 bindings + OPS D1: PASS theo cấu hình.
- OPS R2 binding: PASS theo cấu hình.
- Capability Catalog: 135 module, Super Admin nhìn đủ 135/135.
- Executive: read-only visibility test PASS.
- Education Admin: SLC manage / Member HR hidden test PASS.
- Source data layer mutation guard: PASS; `src/data.js` không có INSERT/UPDATE/DELETE/DROP/ALTER.
- PBKDF2, Strict cookie, CSP, CSRF, login rate limit, audit: PASS static validation.
- Migration tạo đủ bảng Ops core: PASS.

## Chưa thể xác minh trước deploy

- Kết nối remote thật tới 7 D1 Cloudflare.
- Health request thật tới 8 production domains.
- Custom domain `ops.skyfirst.io.vn`.
- Cron execution trên Cloudflare.
- R2 snapshot remote thật.

Các mục này phải regression sau deploy vì môi trường build hiện tại không mang quyền truy cập Cloudflare account của người dùng.
