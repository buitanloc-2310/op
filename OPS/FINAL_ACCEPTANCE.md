# FINAL ACCEPTANCE — OPS 10 SERVICES

## Kết quả
- PASS — catalog được mở rộng từ 8 lên 10 hệ thống: thêm Xanh Sky First và Research & Innovation Center.
- PASS — Xanh/Research được khai báo Catalog/Deep Link; không giả lập D1 binding, SSO hay remote management.
- PASS — readiness phân biệt binding nguồn với catalog-only.
- PASS — Integrations phân biệt Registered/Reachable/Data binding thay vì nhị phân “Đã kết nối”.
- PASS — bỏ auto-refresh overview mỗi 60 giây để tránh COUNT D1 định kỳ; refresh tổng hợp là thao tác chủ động.
- PASS — không thêm migration và không thêm D1 binding cho Xanh/Research.
- PASS — giới hạn source dưới 100 file.
- NOT TESTABLE LOCALLY — schema D1 production của các hệ thống nguồn.
- NOT TESTABLE LOCALLY — Cloudflare production D1/R2/custom domain/cron.
- NOT TESTABLE LOCALLY — quyền đăng nhập thực tế của Xanh/Research; OPS chỉ deep-link.

## Lưu ý kiến trúc
Catalog ≠ health ≠ data integration ≠ management integration. HTTP homepage thành công chỉ được xem là reachability, không phải health machine-readable.

## File count
- PASS — 34 file tổng cộng (giới hạn ≤100).
