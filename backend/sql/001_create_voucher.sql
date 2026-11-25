-- Migration 001: Tạo bảng voucher để bảo lưu 100% tiền cọc khi khách hủy lịch trước 48 giờ (hạn dùng 6 tháng)
-- Chạy đoạn SQL này trong Supabase Dashboard -> SQL Editor

CREATE TABLE IF NOT EXISTS public.voucher (
  id SERIAL PRIMARY KEY,
  ma_voucher VARCHAR(50) NOT NULL UNIQUE,
  khach_hang_id INTEGER NOT NULL REFERENCES public.nguoi_dung(id) ON DELETE CASCADE,
  don_dat_lich_goc_id INTEGER UNIQUE REFERENCES public.don_dat_lich(id) ON DELETE SET NULL,
  gia_tri NUMERIC NOT NULL CHECK (gia_tri > 0),
  han_su_dung TIMESTAMPTZ NOT NULL,
  da_su_dung BOOLEAN NOT NULL DEFAULT false,
  don_dat_lich_su_dung_id INTEGER REFERENCES public.don_dat_lich(id) ON DELETE SET NULL,
  ngay_su_dung TIMESTAMPTZ,
  ngay_tao TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Bổ sung cột liên kết voucher vào bảng don_dat_lich (phục vụ áp dụng voucher khi đặt đơn mới)
ALTER TABLE public.don_dat_lich
  ADD COLUMN IF NOT EXISTS voucher_id INTEGER REFERENCES public.voucher(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tien_giam_voucher NUMERIC NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_voucher_khach_hang_id ON public.voucher(khach_hang_id);
CREATE INDEX IF NOT EXISTS idx_voucher_ma_voucher ON public.voucher(ma_voucher);
