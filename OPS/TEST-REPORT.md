# Kiểm thử OPS 2.0.0 — 05/10/2026

## Đã chạy

- `npm run validate:all`: 50 kiểm tra cấu trúc + 15 privacy/UI + 20 kiểm tra tĩnh cũ = 85/85 PASS.
- `npm test`: 16/16 PASS trên Node 24 và SQLite trong bộ nhớ, gồm 11 ca con API, 1 nhóm API và 4 ca độc lập.
- Cú pháp JavaScript: PASS.

Kiểm thử thực thi gồm bootstrap, secret, đăng nhập, cookie, chặn nguồn khác, CSRF, tạo/cập nhật/mở lại sự cố, ID không tồn tại, bảo vệ quyền bản thân, bắt buộc đổi mật khẩu ở backend, ngăn system_admin tạo super_admin, dữ liệu thiếu, quyền báo cáo lịch sử, phiên hiện tại, truy vấn lỗi 503, cookie lỗi encoding, JSON byte/type limit, cộng nguồn được xem và vòng đời cảnh báo định kỳ.

Lỗi CSRF_INVALID và SOURCE_UNAVAILABLE được ghi ra log trong kiểm thử âm là dự kiến. Kiểm thử scheduler dùng phản hồi HTTP mô phỏng, SQLite thật; không gọi dịch vụ thật.

## Chưa chạy / không suy diễn thành PASS

- Chromium/Playwright end-to-end: chưa chạy. Môi trường không có binary; tải về thất bại do archive không hợp lệ. Không có ảnh chụp màn hình kiểm chứng. Script `scripts/browser-smoke.cjs` là bộ kiểm thử bàn giao chưa chạy.
- Cloudflare runtime, Wrangler build/deploy, D1/R2 production, custom domain, cookie HTTPS trên domain thật.
- Kiểm thử tải, truy cập đồng thời nhiều vùng, SSO/MFA, khôi phục backup, schema nguồn thực.

## Cách chạy smoke test trình duyệt

Cài Playwright tại máy có mạng phù hợp (`npm install --no-save playwright`, `npx playwright install chromium`). Mở máy chủ local mới với database trong bộ nhớ ở terminal thứ nhất (`npm run dev:local`). Ở terminal thứ hai, từ thư mục OPS:

```sh
node scripts/browser-smoke.cjs
```

Script yêu cầu DB chưa khởi tạo, tạo tài khoản thử tại localhost, thử các luồng cơ bản và chụp ảnh vào `test-artifacts`. Không chạy script này trên domain thật. Kết quả này cần được người triển khai xác nhận trước nghiệm thu giao diện.
