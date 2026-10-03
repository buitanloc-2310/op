# Trung tâm Điều hành Sky First (OPS)

Domain dự kiến: `https://ops.skyfirst.io.vn`

OPS là control plane của hệ sinh thái Sky First: tổng hợp dữ liệu, capability, cảnh báo, search, audit, security, incident và report. Dữ liệu nghiệp vụ gốc vẫn thuộc từng hệ thống chuyên trách.

## 8 hệ thống đã đăng ký

1. SLC — `slc.skyfirst.io.vn`
2. Exam — `exam.skyfirst.io.vn`
3. Member — `member.skyfirst.io.vn`
4. TNV — `tnv.skyfirst.io.vn`
5. CTT — `ctt.skyfirst.io.vn`
6. Website — `skyfirst.io.vn`
7. SFEC — `sfec.skyfirst.io.vn`
8. Mail — `mail.skyfirst.io.vn`

Exam không có D1 riêng; runtime Exam dùng API/dữ liệu kỳ thi do SLC sở hữu.

## Nguyên tắc an toàn

- 7 D1 nguồn chỉ được đọc trong `src/data.js` bằng câu lệnh `SELECT`.
- Không có lệnh ghi vào D1 nguồn trong OPS.
- Thao tác nghiệp vụ nhạy cảm được deep-link về hệ thống nguồn.
- OPS chỉ ghi vào D1 `ops` và R2 bucket `ops`.
- Mọi API OPS đều kiểm tra session + capability; API ghi yêu cầu CSRF.
- Mật khẩu dùng PBKDF2-SHA256 210.000 vòng.
- Session cookie HttpOnly + Secure + SameSite=Strict.
- Super Admin thấy toàn bộ catalog; các role khác chỉ nhận module có capability tương ứng.

## Khởi tạo

```bash
npm install
npx wrangler secret put SETUP_SECRET
npm run db:migrate
npm run validate
npm run deploy
```

Sau deploy, truy cập `ops.skyfirst.io.vn`. Lần đầu giao diện sẽ yêu cầu `SETUP_SECRET`, họ tên, email và mật khẩu để tạo Super Admin đầu tiên. Khi tài khoản đầu tiên đã tồn tại, endpoint bootstrap tự khóa.

## Bindings

- OPS_DB → D1 `ops`
- OPS_R2 → R2 `ops`
- SLC_DB → `skyfirsthoctap`
- MEMBER_DB → `tk`
- TNV_DB → `tnv-sfec`
- CTT_DB → `sfn-app-db`
- WEB_DB → `wed`
- SFEC_DB → `sfec-app-db`
- MAIL_DB → `sky-first-mail`

Tất cả D1 nguồn phải nằm trong cùng Cloudflare account với Worker OPS để binding hoạt động.

## Role mặc định

- `super_admin` — toàn bộ capability.
- `executive` — xem toàn hệ sinh thái, report/search, không ghi nghiệp vụ nguồn.
- `system_admin` — health/security/audit/integration và system operations.
- `education_admin` — SLC/Exam và phần giáo dục liên quan.
- `hr_admin` — Member/TNV và phần nhân sự/tuyển dụng.
- `communications_admin` — Website/CMS/media.
- `auditor` — read-only + audit/security.
- `viewer` — overview + health tối thiểu.

Có thể bổ sung capability riêng cho từng tài khoản bằng `capabilities_json`.

## Chạy kiểm tra

```bash
npm run check
npm run validate
```

Validator kiểm tra đủ 8 services, 7 D1 nguồn + D1/R2 Ops, security primitives, migration, permission behavior và đảm bảo data layer không có SQL mutation đối với source databases.
