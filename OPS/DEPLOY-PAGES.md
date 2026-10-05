# Triển khai Pages và lịch giám sát

## Pages hiện có

1. Giải nén, dùng nội dung trong `op-main/OPS`. Nếu giữ nguyên cây thư mục ZIP trong repository, Root directory là `op-main/OPS`; nếu chỉ đưa nội dung OPS vào repo, root để trống.
2. Build command `npm run build`; output `public`; Framework preset None.
3. Cài dependencies bằng `npm install`. Package giữ phiên bản Wrangler từ gói gốc; vòng sửa này chưa cài/chạy Wrangler hoặc tạo lockfile. Cần xác nhận dependency cài thành công trong môi trường triển khai.
4. Xác minh các D1 ID/bucket trong `wrangler.jsonc`; không sao chép secret vào repo. Nguồn khác tài khoản cần kiến trúc tích hợp riêng và quyền phù hợp, không chỉ đổi tên binding.
5. Với database hoàn toàn mới, chạy `npm run db:migrate` trước khi mở ứng dụng. Với database đã được bản trước tạo schema lúc chạy, không áp lại migration thêm cột một cách mù quáng: kiểm tra bảng migration và cột must_change_password trước. Nâng cấp 2.0 này không thêm bảng/cột bắt buộc.
6. Đặt secret `SETUP_SECRET` trên Pages. Khởi tạo quản trị đầu tiên, sau đó xóa secret này khỏi cấu hình để đóng thiết lập.
7. Triển khai `npm run deploy` trong OPS hoặc build qua Git. Kiểm tra `/`, `/api/health`, đăng nhập, đổi mật khẩu tạm, sự cố, báo cáo và trang Kết nối hệ thống.
8. Khi mới nâng cấp, tải lại trang để nhận JS/CSS mới.

## Worker định kỳ tùy chọn

Pages HTTP handler không tự kích hoạt hàm scheduled trong src/index.js. Bản này kèm một Worker riêng:

```sh
npm run deploy:scheduler
```

Lệnh dùng `wrangler.scheduler.jsonc`, entry `src/scheduler.js`, chạy mỗi 15 phút. Xác minh tất cả binding của scheduler cùng trỏ đến đúng nguồn của Pages. Worker không xuất HTTP fetch handler. Có thể đổi crons thành [] để tắt lịch. Khi thử lại scheduler, kiểm tra log và bảng ops_alerts/ops_kpi_snapshots.

Tự làm mới 60 giây trên UI chỉ cập nhật khi mở trang. Scheduler chạy độc lập sau khi được triển khai; không tự động được cài bởi lệnh deploy Pages.

## Tài liệu chính thức đối chiếu

- https://developers.cloudflare.com/pages/functions/bindings/
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/

Lịch dự kiến là cấu hình nguồn đã viết; chưa được triển khai vào tài khoản của bạn trong vòng bàn giao.
