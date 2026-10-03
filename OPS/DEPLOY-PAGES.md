# Deploy vào project Pages hiện tại

Với project đang có domain `op-ehp.pages.dev`:

1. Đưa **nội dung bên trong ZIP này** lên root repo GitHub.
2. Cloudflare Pages → Settings → Builds:
   - Root directory: để trống
   - Build command: `npm run build`
   - Build output directory: `public`
3. Settings → Variables and Secrets:
   - thêm Secret `SETUP_SECRET`
4. Các D1/R2 binding có thể lấy từ `wrangler.jsonc`; nếu dashboard yêu cầu binding thủ công thì tên phải khớp chính xác:
   `OPS_DB`, `SLC_DB`, `MEMBER_DB`, `TNV_DB`, `CTT_DB`, `WEB_DB`, `SFEC_DB`, `MAIL_DB`, `OPS_R2`.
5. Redeploy.
6. Test:
   - `/`
   - `/api/health`
   - sau đăng nhập: mục Tích hợp.

Lưu ý: Bản V1 trước là cấu hình Worker (`main` + `assets`) nên khi đưa thẳng vào Pages mà không chỉ định output đúng, root có thể 404.
