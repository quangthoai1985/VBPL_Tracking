-- ============================================================
-- MIGRATION: Thêm cột mới cho hệ thống Hình thức xử lý
-- Chạy SQL này trên Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Thêm cột doc_category (nhóm radio)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS doc_category text NOT NULL DEFAULT 'van_ban_tiep_tuc';

-- 2. Nhóm "Văn bản tiếp tục áp dụng" (4 thuộc tính)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_tt_thay_the integer NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_tt_bai_bo integer NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_tt_khong_xu_ly integer NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_tt_het_hieu_luc integer NOT NULL DEFAULT 0;

-- 3. Nhóm "Văn bản mới" (4 thuộc tính)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_vm_ban_hanh_moi integer NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_vm_sua_doi_bo_sung integer NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_vm_thay_the integer NOT NULL DEFAULT 0;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS count_vm_bai_bo integer NOT NULL DEFAULT 0;

-- 4. Flag needs_review - đánh dấu VB cũ cần rà soát lại
ALTER TABLE documents ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

-- ============================================================
-- 5. MIGRATION DỮ LIỆU CŨ → CỘT MỚI (Phương án A)
-- ============================================================

-- Map count_thay_the → count_tt_thay_the (nhóm VB tiếp tục)
UPDATE documents SET count_tt_thay_the = count_thay_the WHERE count_thay_the > 0;

-- Map count_bai_bo → count_tt_bai_bo (nhóm VB tiếp tục)
UPDATE documents SET count_tt_bai_bo = count_bai_bo WHERE count_bai_bo > 0;

-- Map count_ban_hanh_moi → count_vm_ban_hanh_moi (nhóm VB mới)
-- Và đổi doc_category sang 'van_ban_moi'
UPDATE documents SET 
    count_vm_ban_hanh_moi = count_ban_hanh_moi,
    doc_category = 'van_ban_moi' 
WHERE count_ban_hanh_moi > 0;

-- count_chua_xac_dinh → đặt về 0, đánh dấu needs_review = true
UPDATE documents SET needs_review = true WHERE count_chua_xac_dinh > 0;

-- Đánh dấu thêm: VB nào có count mới = 0 tất cả nhưng có legacy > 0 → giữ nguyên doc_category
-- VB nào KHÔNG có count legacy nào > 0 → cũng cần review
UPDATE documents SET needs_review = true 
WHERE count_thay_the = 0 
  AND count_bai_bo = 0 
  AND count_ban_hanh_moi = 0 
  AND count_chua_xac_dinh = 0
  AND count_tt_thay_the = 0 
  AND count_tt_bai_bo = 0 
  AND count_tt_khong_xu_ly = 0 
  AND count_tt_het_hieu_luc = 0
  AND count_vm_ban_hanh_moi = 0 
  AND count_vm_sua_doi_bo_sung = 0 
  AND count_vm_thay_the = 0 
  AND count_vm_bai_bo = 0;

-- ============================================================
-- 6. CẬP NHẬT VIEW v_documents_full (nếu có)
-- ============================================================

-- Drop + recreate view để bao gồm cột mới
DROP VIEW IF EXISTS v_documents_full;

CREATE OR REPLACE VIEW v_documents_full AS
SELECT 
    d.*,
    a.name AS agency_name,
    a.short_name AS agency_short
FROM documents d
LEFT JOIN agencies a ON d.agency_id = a.id;

-- Done!
-- Sau khi chạy, kiểm tra: SELECT count(*) FROM documents WHERE needs_review = true;
