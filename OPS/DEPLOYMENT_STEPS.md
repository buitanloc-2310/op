# DEPLOYMENT STEPS

1. Không có migration mới cho release này.
2. Giữ nguyên các D1/R2 bindings production hiện có. Không cần XANH_DB/RESEARCH_DB.
3. Chạy `npm run validate:all` và `npm test`.
4. Deploy Pages theo cấu hình hiện tại.
5. Nếu dùng scheduler, deploy riêng bằng script hiện có sau khi smoke test Pages.
6. Smoke test: login, Catalog đủ 10 hệ thống, Systems hiển thị Xanh/Research, Integrations ghi Catalog/Deep Link cho hai hệ thống mới, mở link ngoài đúng domain.
7. Nếu có lỗi, rollback deployment Pages về release trước; không có DB migration cần rollback.
