# Phạm vi tích hợp 2.0.0

OPS_DB lưu người dùng, phiên, sự cố, cảnh báo, audit và báo cáo. OPS_R2 nhận bản sao JSON. Bảy database nguồn chỉ được đọc bởi src/data.js. Exam dùng dữ liệu SLC; trạng thái kết nối dữ liệu của Exam kế thừa SLC, còn health HTTP kiểm tra riêng.

Có 8 dịch vụ và danh mục liên kết chức năng kế thừa. Việc xuất hiện trong catalog không chứng minh chức năng đích đã hoạt động; quyền OPS không phải SSO hoặc quyền hệ thống đích.

Trang kết nối chỉ thử SELECT 1 và R2 list. Khi kiểm tra dữ liệu nguồn lỗi, KPI có thể là null; danh sách chờ báo partial; kiểm tra chất lượng báo skipped. Đối chiếu schema nguồn là công việc bắt buộc trước nghiệm thu production. Chưa kết nối D1/R2 thật trong vòng sửa này.

Chi tiết vấn đề và sửa chữa trong UPGRADE-AUDIT.md; kết quả kiểm thử trong TEST-REPORT.md.
