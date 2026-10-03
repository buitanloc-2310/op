# Trung tâm Điều hành Sky First — Pages V2

Bản này được sửa riêng cho **Cloudflare Pages + Pages Functions**.

## Cloudflare Pages
- Root directory: để trống nếu repo chứa trực tiếp các file của gói này.
- Build command: `npm run build`
- Build output directory: `public`
- Framework preset: None
- Production branch: `main`

`public/index.html` là trang gốc. API chạy qua `functions/api/[[path]].js`.

## Bindings
Wrangler đã khai báo:
- OPS_DB → D1 `ops`
- OPS_R2 → R2 `ops`
- SLC_DB, MEMBER_DB, TNV_DB, CTT_DB, WEB_DB, SFEC_DB, MAIL_DB → 7 D1 nguồn

Exam không có D1 riêng; dữ liệu Exam thuộc SLC.

## Secret bắt buộc
Tạo biến mã hóa `SETUP_SECRET` trong Cloudflare Pages trước lần khởi tạo đầu tiên.
Không ghi secret trực tiếp vào GitHub.

## Khởi tạo D1
Bản V2 có cơ chế tạo schema Ops lần đầu bằng `CREATE TABLE IF NOT EXISTS`, đồng thời vẫn giữ migration `0001_ops_core.sql`.
Nếu muốn quản lý migration thủ công, có thể chạy `npm run db:migrate`.

## An toàn
- 7 D1 nguồn chỉ SELECT.
- Ops chỉ ghi vào OPS_DB và OPS_R2.
- API ghi có CSRF.
- Session cookie HttpOnly + Secure + SameSite=Strict.
- Password PBKDF2-SHA256.
- Super Admin thấy toàn bộ Capability Catalog; role khác lọc ở server.

## Kiểm tra sau deploy
1. Mở `/` phải hiện giao diện, không 404.
2. Mở `/api/health` phải trả JSON `ok:true`.
3. Khởi tạo Super Admin.
4. Vào **Tích hợp** để kiểm tra 7 D1 + R2 thật.
5. Chỉ khi các binding đều xanh mới coi integration production sẵn sàng.
