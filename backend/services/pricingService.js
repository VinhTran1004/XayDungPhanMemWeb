const supabase = require('../config/supabase');
const { AppError } = require('../utils/response');

/**
 * Calculate total price, voucher discount, 30% deposit, and 70% remaining balance from live DB prices.
 */
const calculateBookingPricing = async ({ goiDichVuId, dichVuThem = [], maVoucher = null, khachHangId = null }) => {
  const { data: pkg, error: pkgErr } = await supabase
    .from('goi_dich_vu')
    .select('*')
    .eq('id', goiDichVuId)
    .eq('trang_thai', true)
    .maybeSingle();

  if (pkgErr) {
    throw new AppError(`Lỗi truy vấn gói dịch vụ: ${pkgErr.message}`, 500, 'DATABASE_ERROR');
  }
  if (!pkg) {
    throw new AppError('Không tìm thấy gói dịch vụ yêu cầu', 404, 'PACKAGE_NOT_FOUND');
  }

  // Merge duplicate addon IDs if client submits multiples of the same addon
  const mergedAddonQty = new Map();
  for (const item of dichVuThem) {
    const addonId = Number(item.dich_vu_cong_them_id);
    const qty = Number(item.so_luong || 1);
    mergedAddonQty.set(addonId, (mergedAddonQty.get(addonId) || 0) + qty);
  }

  const addonItems = [];
  let tongTienDichVuThem = 0;

  if (mergedAddonQty.size > 0) {
    const addonIds = Array.from(mergedAddonQty.keys());
    const { data: addons, error: addonErr } = await supabase
      .from('dich_vu_cong_them')
      .select('*')
      .in('id', addonIds)
      .eq('trang_thai', true);

    if (addonErr) {
      throw new AppError(`Lỗi truy vấn dịch vụ cộng thêm: ${addonErr.message}`, 500, 'DATABASE_ERROR');
    }

    const addonMap = new Map((addons || []).map((a) => [a.id, a]));
    for (const [addonId, soLuong] of mergedAddonQty.entries()) {
      const addon = addonMap.get(addonId);
      if (!addon) {
        throw new AppError(`Dịch vụ cộng thêm #${addonId} không tồn tại hoặc đã ngừng áp dụng`, 404, 'ADDON_NOT_FOUND');
      }
      const donGia = Number(addon.gia);
      const thanhTien = donGia * soLuong;
      tongTienDichVuThem += thanhTien;
      addonItems.push({
        dich_vu_cong_them_id: addon.id,
        ten_dich_vu: addon.ten_dich_vu,
        don_vi_tinh: addon.don_vi_tinh,
        so_luong: soLuong,
        don_gia: donGia,
        thanh_tien: thanhTien,
      });
    }
  }

  const giaGoi = Number(pkg.gia_co_ban);
  const giaGoc = giaGoi + tongTienDichVuThem;

  let voucherRecord = null;
  let tienGiamVoucher = 0;

  if (maVoucher && String(maVoucher).trim()) {
    const normalizedCode = String(maVoucher).trim().toUpperCase();
    const { data: voucher, error: vErr } = await supabase
      .from('voucher')
      .select('*')
      .eq('ma_voucher', normalizedCode)
      .maybeSingle();

    if (vErr) {
      throw new AppError(`Lỗi kiểm tra voucher: ${vErr.message}`, 500, 'DATABASE_ERROR');
    }
    if (!voucher) {
      throw new AppError('Mã voucher không tồn tại', 404, 'VOUCHER_NOT_FOUND');
    }
    if (khachHangId && voucher.khach_hang_id !== khachHangId) {
      throw new AppError('Voucher này không thuộc tài khoản của bạn', 403, 'VOUCHER_FORBIDDEN');
    }
    if (voucher.da_su_dung) {
      throw new AppError('Voucher này đã được sử dụng', 400, 'VOUCHER_ALREADY_USED');
    }
    if (new Date(voucher.han_su_dung).getTime() <= Date.now()) {
      throw new AppError('Voucher này đã hết hạn sử dụng', 400, 'VOUCHER_EXPIRED');
    }

    voucherRecord = voucher;
    tienGiamVoucher = Math.min(Number(voucher.gia_tri), giaGoc);
  }

  const tongTien = Math.max(0, giaGoc - tienGiamVoucher);
  const tienCoc = Math.round(tongTien * 0.3);
  const tienConLai = tongTien - tienCoc;

  return {
    goi_dich_vu: pkg,
    chi_tiet_dich_vu_them: addonItems,
    voucher: voucherRecord,
    gia_goi: giaGoi,
    tong_tien_dich_vu_them: tongTienDichVuThem,
    gia_goc: giaGoc,
    tien_giam_voucher: tienGiamVoucher,
    tong_tien: tongTien,
    tien_coc: tienCoc,
    tien_con_lai: tienConLai,
  };
};

module.exports = {
  calculateBookingPricing,
};
