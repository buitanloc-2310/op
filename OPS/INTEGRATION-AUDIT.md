# OPS Integration Audit — baseline 2026-10-03

Bản OPS này được thiết kế từ 8 source production được cung cấp cùng ngày.

| Hệ thống | Runtime | D1 | R2 / storage | Cách OPS kết nối |
|---|---|---|---|---|
| SLC | Cloudflare Pages/Functions | `skyfirsthoctap` | `skyfirsthoctap` | D1 read-only + health |
| Exam | Cloudflare Worker/assets | Không có DB riêng | Static assets | HTTP health; dữ liệu attempt/exam đọc từ SLC |
| Member | Cloudflare Worker | `tk` | `tksfn` | D1 read-only |
| TNV | Cloudflare Worker | `tnv-sfec` | `tnv-sfn-files` | D1 read-only + health/status |
| CTT | Cloudflare Worker | `sfn-app-db` | `sfn-app-files` | D1 read-only + health |
| Website | Cloudflare Pages | `wed` | `wed` | D1 read-only + root health probe |
| SFEC | Cloudflare Worker | `sfec-app-db` | `sfec-app-files` | D1 read-only + health |
| Mail | Cloudflare Worker | `sky-first-mail` | `sky-first-mail-storage` | D1 read-only + health |

## Capability catalog

Catalog hiện đăng ký 135 module/chức năng cấp cao từ 8 hệ thống. Super Admin nhận toàn bộ; các role khác được lọc server-side trước khi trả về frontend.

## Những gì đã triển khai trong OPS v1

- Auth riêng cho Trung tâm Điều hành.
- One-time setup bằng `SETUP_SECRET`.
- RBAC/capability visibility.
- Dashboard KPI từ 7 D1 nguồn.
- Health check 8 hệ thống.
- Pending-work aggregation.
- Global search có masking email.
- Capability Catalog + deep link về hệ thống nguồn.
- Security summary.
- Incident Center.
- Audit Center của OPS.
- Snapshot KPI lưu D1 + R2 Ops.
- Quản lý tài khoản/role OPS.
- Integration registry.
- Daily scheduled snapshot.

## Cố ý chưa làm write-through vào source systems

Không proxy CREATE/UPDATE/DELETE trực tiếp vào SLC/Member/TNV/CTT/SFEC/Mail/Website trong v1. Việc này là chủ ý an toàn: các hệ thống đang có auth, validation, audit và workflow khác nhau. OPS hiển thị toàn bộ capability và deep-link về source app, trong khi đọc tổng hợp qua D1. Khi cần write-through, mỗi hệ thống nên có service endpoint nội bộ có scope riêng thay vì cho OPS ghi thẳng database.
