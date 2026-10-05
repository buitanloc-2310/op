# Sky First Operations Center — 2.0.0

Bản nâng cấp từ ZIP người dùng cung cấp, ngày 05/10/2026. Đây là trung tâm tổng hợp theo dõi và xử lý sự cố nội bộ; danh mục các hệ thống khác là liên kết điều hướng, không phải 135 chức năng đã được tích hợp để điều khiển từ xa.

## Những gì đã có

- Giao diện tổng quan navy/xanh, chỉ số rõ ràng, menu đầy đủ trên điện thoại.
- Bảng sự cố bốn trạng thái: mới, đang xử lý, theo dõi, đã xử lý; tìm kiếm, lọc mức độ, xem mô tả và cập nhật.
- Theo dõi điểm kiểm tra dịch vụ: HTTP, thời gian phản hồi; tùy chọn làm mới 60 giây khi trang đang mở.
- Xem và tải JSON báo cáo theo thời điểm; phân quyền dữ liệu lịch sử.
- Xem phiên đăng nhập, thu hồi thiết bị khác, đổi mật khẩu cho mọi người dùng qua nút Tài khoản.
- Chặn truy cập API khi chưa đổi mật khẩu tạm; chỉ super_admin được sửa tài khoản/quyền; đổi quyền thu hồi phiên.
- Xử lý dữ liệu thiếu ở danh sách chờ và kiểm tra chất lượng; không coi truy vấn thất bại là dữ liệu sạch.
- Worker định kỳ tùy chọn, tách khỏi ứng dụng Pages, kiểm tra mỗi 15 phút.
- Kiểm thử API thật với SQLite cục bộ, không dùng dữ liệu tài khoản thật.

## Chạy ngay trên máy, không cần D1/R2

Yêu cầu Node.js 24+. Từ thư mục `OPS`:

```sh
npm run dev:local
```

Mở http://localhost:8788. Mã thiết lập mặc định chỉ cho localhost là `local-setup-only`. Tạo email và mật khẩu của riêng bạn trên màn hình thiết lập. Không có tài khoản/mật khẩu mặc định trong bản triển khai.

Mặc định dữ liệu cục bộ nằm trong bộ nhớ, mất khi dừng tiến trình. Để lưu SQLite cục bộ:

```sh
OPS_LOCAL_DB=./local-ops.sqlite OPS_SETUP_SECRET='ma-thiet-lap-cua-ban' npm run dev:local
```

Máy chủ này chỉ lắng nghe localhost, chặn kiểm tra mạng Sky First thành trạng thái chưa xác nhận và không kết nối D1/R2 thật. Các chỉ số nguồn sẽ hiện thiếu dữ liệu; bạn vẫn thử được thiết lập, đăng nhập, tạo/cập nhật sự cố, quản lý tài khoản, báo cáo, phiên đăng nhập. Không dùng local-server để chạy production.

## Kiểm thử

```sh
npm run validate:all
npm test
```

Kết quả vòng bàn giao: 85 kiểm tra tĩnh PASS, 16 kiểm thử Node PASS. Chi tiết và giới hạn trong `TEST-REPORT.md`. Cụm “production readiness” trong tên script cũ chỉ là kiểm tra tĩnh, không phải chứng nhận production.

## Triển khai

Xem `DEPLOY-PAGES.md`. Cấu hình D1/R2 gốc được giữ nguyên; cần xác minh chúng thuộc tài khoản Cloudflare sẽ triển khai. Không có secret được đưa vào ZIP. Không tự động triển khai trong vòng sửa này.

## Phạm vi và giới hạn

- Quyền của OPS không cấp quyền đăng nhập vào các hệ thống đích; mỗi hệ thống đích tự xác thực.
- Không có SSO, quản lý nghiệp vụ liên hệ thống, sửa dữ liệu nguồn, gửi cảnh báo email/Zalo, uptime lịch sử hoặc phần trăm SLA.
- “Đã kết nối” chỉ xác nhận truy vấn đơn giản/R2 list thành công, không chứng minh toàn bộ schema nguồn tương thích.
- Danh sách chờ: tối đa 25 bản ghi mỗi nguồn và tổng 100. Sự cố: 200; cảnh báo: 250; audit: 300; báo cáo: 120. Đây chưa phải phân trang lịch sử đầy đủ.
- Tổng bản ghi người/tài khoản không khử trùng một người ở nhiều nguồn. KPI tổng hợp ở cấp hệ thống được cấp quyền; chưa có phân quyền đến từng hàng dữ liệu.
- Tìm kiếm và số liệu an toàn vẫn phụ thuộc schema nguồn; tìm kiếm chưa có báo cáo độ phủ từng nguồn.
- Báo cáo được đọc từ OPS_DB. R2 là bản sao lưu JSON phụ trợ, chưa có thao tác phục hồi tự động. Nếu R2 lỗi, API báo đã lưu DB nhưng chưa lưu trữ dự phòng.
- Báo cáo cũ/định kỳ chỉ super_admin xem. Báo cáo mới chỉ người tạo với tập quyền không đổi hoặc super_admin xem.
- PBKDF2 kế thừa 100.000 vòng; chưa có MFA hay quy trình quên mật khẩu. Chưa đánh giá chống tấn công ở mức hạ tầng.
- Chưa thực hiện kiểm thử hiển thị bằng trình duyệt do môi trường không tải được Chromium. Có script để chạy tiếp, không coi giao diện đã được nghiệm thu trực quan.
