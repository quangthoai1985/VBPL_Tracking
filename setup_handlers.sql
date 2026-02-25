-- Chạy mã SQL này trong Supabase > SQL Editor để tạo bảng handlers và các dữ liệu ban đầu
CREATE TABLE IF NOT EXISTS public.handlers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Thêm quyền RLS (Row Level Security)
ALTER TABLE public.handlers ENABLE ROW LEVEL SECURITY;

-- Cho phép mọi user (kể cả anon) có thể đọc danh sách chuyên viên để hiển thị trên giao diện
CREATE POLICY "Cho phép tất cả đọc danh sách chuyên viên" 
ON public.handlers FOR SELECT 
USING (true);

-- Cho phép user đã đăng nhập (authenticated) có quyền thêm, sửa, xóa chuyên viên
CREATE POLICY "Cho phép admin/authenticated được toàn quyền" 
ON public.handlers FOR ALL 
USING (auth.role() = 'authenticated');

-- Chèn các dữ liệu mẫu mặc định theo mảng HANDLER_NAMES cũ
INSERT INTO public.handlers (name) 
VALUES 
    ('Thảo'), 
    ('Nhung'), 
    ('Trâm'), 
    ('Loan'), 
    ('Thanh Hằng')
ON CONFLICT (name) DO NOTHING;
