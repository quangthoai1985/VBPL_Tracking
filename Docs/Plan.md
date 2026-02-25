# Kế Hoạch Xây Dựng Website Quản Lý Xử Lý Văn Bản Quy Phạm Pháp Luật (VBQPPL)

**Tác giả kế hoạch**: Grok (dựa trên phân tích file Excel "2026-Theo Doi Tien Do Ban Hanh VBQPPL.xlsx")  
**Người thực hiện**: Quang Thoại (@QuangThoai1985) – Sở Tư pháp tỉnh An Giang  
**Mục đích**: Chuyển đổi quy trình quản lý thủ công trên Excel sang website chuyên dụng, hỗ trợ theo dõi tiến độ xử lý Nghị quyết (NQ) và Quyết định (QD) từ HĐND/UBND tỉnh An Giang và Kiên Giang trước ngày 01/7/2025.  
**Ngày lập**: Tháng 2/2026  

## 1. Phân Tích Yêu Cầu Hệ Thống

### Mục tiêu chính
- Quản lý, theo dõi và báo cáo tiến độ xử lý VBQPPL (Nghị quyết và Quyết định).
- Thay thế hoàn toàn Excel, hỗ trợ đa người dùng (chuyên viên, cơ quan soạn thảo, admin).
- Giai đoạn phát triển/test: Dữ liệu dummy, deploy public để Sở Tư pháp truy cập từ xa góp ý.
- Giai đoạn production: Dữ liệu thực lưu trữ tại Việt Nam (VPS nội bộ Ubuntu + Dokploy), không public.

### Dựa trên cấu trúc Excel
- **Entities chính**:
  - Nghị quyết (NQ): Từ sheet "NQ can xu ly" và "NQ HDND da xu ly".
  - Quyết định (QD): Từ sheet "QD UBND can xu ly" và "QD UBND da xu ly".
  - Tổng hợp: Từ sheet "Tong Hop Chung".
- **Các trường chính** (columns):
  - STT, Tên văn bản, Cơ quan soạn thảo, Hình thức xử lý (Thay thế / Bãi bỏ / Ban hành mới / Chưa xác định / Hết hiệu lực / Giữ nguyên), Người xử lý (Thảo, Nhung, Trâm, Loan, Thanh Hằng,...), Văn bản đăng ký, Ngày nhận/Số vb phúc đáp, Ý kiến chấp thuận, Gửi lấy ý kiến góp ý, Gửi Sở Tư pháp thẩm định, Trình UBND/HĐND, Số/Ngày ban hành VBQPPL, Ghi chú, Thời gian xử lý.
- **Workflow**:
  1. Thêm văn bản mới → Phân công người xử lý.
  2. Cập nhật tiến độ (đăng ký → lấy ý kiến → thẩm định → trình ban hành).
  3. Chuyển trạng thái từ "Cần xử lý" sang "Đã xử lý".
  4. Báo cáo tổng hợp theo lĩnh vực, người xử lý, thời gian.
  5. Tìm kiếm/filter/sort, export/import Excel/CSV/PDF.

### Vai trò người dùng
- Admin: Quản lý user, import dữ liệu, báo cáo toàn cục.
- Chuyên viên: Cập nhật tiến độ văn bản được phân công.
- Cơ quan soạn thảo: Đăng ký văn bản mới, theo dõi.
- Guest (test): Xem báo cáo công khai (không edit).

### Yêu cầu phi chức năng
- Bảo mật: JWT auth, role-based access.
- Hiệu suất: Hỗ trợ 100+ users, hàng nghìn records.
- Responsive: Mobile-friendly.
- Notification: Email khi cập nhật tiến độ (tùy chọn).
- Tuân thủ: Dữ liệu production phải lưu tại Việt Nam.

## 2. Kế Hoạch Phát Triển (Phân chia phases cho Antigravity agents)

### Phase 1: Planning & Setup
- Tạo project Git.
- Thiết lập Docker Compose từ đầu để dễ migrate.
- Yêu cầu agents: Generate project structure, Dockerfile, docker-compose.yml.

### Phase 2: Database Design
- Sử dụng PostgreSQL.
- Schema chính:
  - Table `documents`:
    - id (PK)
    - type (enum: 'NQ', 'QD')
    - name (text)
    - drafting_agency (varchar)
    - processing_form (enum)
    - status (enum: 'can_xu_ly', 'da_xu_ly')
    - handler_id (FK → users)
    - registration_doc, receive_date, approval_opinion, feedback_sent, appraisal_sent, submission_date, issuance_number, issuance_date, notes, processing_time
    - created_at, updated_at
  - Table `users`: id, username, role, email, password_hash
  - Views/queries cho báo cáo tổng hợp.

### Phase 3: Backend Development
- Framework: Python + FastAPI
- Endpoints:
  - GET /documents?type=NQ&status=can_xu_ly (filter, pagination)
  - POST /documents, PUT /documents/:id, DELETE /documents/:id
  - GET /summaries (báo cáo theo lĩnh vực/người)
  - POST /import (Excel/CSV)
  - Auth: /login, /register
- DB connection: SQLAlchemy + psycopg2

### Phase 4: Frontend Development
- Framework: React.js (hoặc Next.js cho full-stack)
- UI: Material-UI / Ant Design
- Layout: Sidebar (Tổng hợp, NQ Cần Xử Lý, NQ Đã Xử Lý, QD Cần Xử Lý, QD Đã Xử Lý, Báo Cáo, Quản lý User)
- Components:
  - Dashboard: Cards + Charts (Chart.js)
  - Tables: React Table / MUI DataGrid (sortable, filterable)
  - Forms: Modal với date picker, dropdown enums
- Deploy: Cloudflare Pages (static React) hoặc Next.js trên Cloudflare Pages + Functions

### Phase 5: Deployment Strategy
- **Giai đoạn phát triển/test**:
  - Database: Supabase PostgreSQL (dữ liệu dummy, không dùng dữ liệu thực)
  - Frontend: Deploy lên Cloudflare Pages (miễn phí, nhanh, domain dễ)
  - Backend: FastAPI deploy lên Cloudflare Workers (nếu serverless) hoặc Vercel tạm thời, hoặc dùng Cloudflare Pages Functions
  - Mục đích: Sở Tư pháp truy cập public để xem demo, góp ý
- **Giai đoạn production**:
  - VPS Ubuntu (Viettel IDC / FPT Cloud / VNG Cloud) → dữ liệu tại Việt Nam
  - Cài Dokploy để deploy Docker containers
  - Database: PostgreSQL local trên VPS
  - Frontend: Static files serve qua Nginx trên VPS (hoặc Cloudflare Tunnel nếu cần secure access)
  - Backend: FastAPI trong Docker, expose nội bộ (IP LAN hoặc VPN)

### Phase 6: Migration Từ Supabase → Dokploy
1. Export dump từ Supabase (pg_dump hoặc dashboard backup)
2. Import vào PostgreSQL local trên VPS
3. Update DB_URL trong backend → localhost
4. Deploy lại qua Dokploy (Git push → auto build)
5. Xóa project Supabase sau migrate

### Phase 7: Testing & Maintenance
- Unit/E2E tests (Jest + Cypress)
- CI/CD: GitHub Actions
- Monitoring: Cloudflare Analytics (test), Sentry (production)

## 3. Tech Stack Đề Xuất
- Backend: Python + FastAPI
- Frontend: React.js / Next.js
- Database: PostgreSQL (Supabase dev → local production)
- Deployment test: Cloudflare Pages + Workers/Functions
- Production: VPS Ubuntu + Dokploy + Nginx
- Auth: JWT (hoặc Supabase Auth cho dev)
- Other: Docker, Git, Chart.js, Axios

## 4. Hướng Dẫn Sử Dụng Với Antigravity
- Paste file này vào Agent Manager.
- Command gợi ý:
  "Generate full-stack web app based on this detailed plan. Use FastAPI backend, React frontend, PostgreSQL. Prepare for Cloudflare deployment in dev phase and Dokploy on Ubuntu VPS in production. Include Dockerfiles and migration steps from Supabase."
- Nếu cần phân tích file Excel: Upload file XLSX/CSV hoặc text dump vào workspace trước.

Chúc dự án thành công!