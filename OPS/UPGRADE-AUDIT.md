# Rà soát và nâng cấp 2.0.0

## Vấn đề xác định từ mã nguồn gốc

| Mức | Vấn đề | Xử lý trong bản này |
|---|---|---|
| Cao | Đổi mật khẩu tạm chỉ được bắt buộc ở UI, có thể gọi API trực tiếp | Middleware API chặn đến khi đổi mật khẩu |
| Cao | system_admin có ops.* và có thể tạo super_admin hoặc gán quyền tùy ý | Chỉ super_admin được thay đổi tài khoản; khóa tự hạ quyền; thu hồi phiên khi thay quyền |
| Cao | Các safeAll thất bại vẫn trả danh sách rỗng thành công | API dữ liệu OPS trả 503; pending trả partial; kiểm tra chất lượng có checked/skipped |
| Cao | Bootstrap kiểm tra rồi INSERT có thể bị đua tạo nhiều tài khoản đầu tiên | INSERT có điều kiện NOT EXISTS trong cùng câu lệnh |
| Cao | Cảnh báo dùng ON CONFLICT không khớp unique partial index, lỗi lại bị nuốt | Thêm điều kiện partial index và kiểm thử chu kỳ cảnh báo bằng SQLite |
| Trung bình | scheduled không có cấu hình lịch và Pages function chỉ chuyển tiếp HTTP | Worker scheduler riêng và cấu hình cron tùy chọn |
| Trung bình | Cookie sai encoding có thể làm request lỗi 500 | Bỏ qua cookie hỏng |
| Trung bình | readJson đọc toàn bộ trước khi giới hạn, đếm ký tự thay vì byte | Giới hạn stream theo byte, từ chối JSON null/mảng |
| Trung bình | Hạ quyền/đổi quyền không thu hồi phiên đăng nhập | Thu hồi phiên khi sửa quyền |
| Trung bình | Mở lại sự cố giữ resolved_at cũ; ID không tồn tại vẫn thành công | Xóa thời gian đóng khi mở lại, trả 404 nếu thiếu |
| Trung bình | Alert đã resolved có thể bị đổi ngược thành acknowledged | Trả 409 cho thao tác đó |
| Trung bình | Retry đồng thời làm bộ đếm đăng nhập dễ mất cập nhật | UPSERT bộ đếm nguyên tử, thêm khóa theo IP |
| Trung bình | Báo cáo chỉ được ghi, không có xem/tải | Endpoint xem có phân quyền lịch sử và tải JSON |
| Trung bình | UI điện thoại ẩn các mục từ thứ 9 | Menu mở/đóng với đủ các mục |
| Trung bình | Tổng KPI bị null vì cộng cả nguồn người dùng không có quyền | Chỉ cộng nguồn có trong tập dữ liệu được phép xem |
| Trung bình | Tìm danh bạ member hiển thị nguyên email ở nhãn chính | Che email; giữ mã chứng nhận ở trường phù hợp |
| Trung bình | Truy vấn chỉ chứa %/_ có thể thành tìm toàn bộ | Từ chối chuỗi sau chuẩn hóa dưới 2 ký tự |
| Trung bình | Health có thể coi HTTP 200 chứa HTML trang đăng nhập là khỏe | Endpoint API phải trả đối tượng JSON, không báo ok:false/status:error |
| Thấp | Tổng các chỉ số không cùng đơn vị ở mỗi hệ thống gây hiểu nhầm | Dùng huy hiệu độ đầy đủ dữ liệu, chú thích tổng bản ghi |
| Thấp | Giao diện chỉ báo lỗi chung, modal khó dùng bàn phím | Ánh xạ một số lỗi thường gặp, Escape/focus trap/trả focus |

## Những việc cần làm tiếp với môi trường thực

1. Đối chiếu schema của 7 D1 nguồn với truy vấn trong src/data.js, nhất là tên cột/trạng thái nghiệp vụ.
2. Nghiệm thu desktop/mobile bằng trình duyệt và kiểm thử tải, tốc độ truy vấn, độ lớn snapshot.
3. Thiết kế API nghiệp vụ giữa các hệ thống nếu muốn duyệt hồ sơ/sửa lớp ngay trong OPS. Danh mục liên kết không thay thế tích hợp này.
4. Bổ sung MFA, khôi phục tài khoản, chính sách lưu trữ/xóa log và backup/restore nếu cần vận hành quy mô lớn.
5. Nếu muốn cảnh báo ngoài ứng dụng, bổ sung kênh gửi và quản lý người nhận; hiện không gửi thông điệp cho bất kỳ ai.

Không thực hiện thay đổi nào trên dữ liệu hay dịch vụ đang chạy của người dùng.
