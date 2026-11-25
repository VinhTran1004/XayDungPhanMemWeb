const supabase = require('../config/supabase');
const { AppError } = require('../utils/response');

const ACTIVE_BOOKING_STATUSES = ['da_coc', 'dang_chup', 'cho_chon_anh', 'dang_chinh_sua', 'hoan_thanh'];
const HOLDING_DURATION_MS = 15 * 60 * 1000;

/**
 * Parse a studio shoot date (YYYY-MM-DD) and slot time (HH:MM:SS) in Vietnam timezone (+07:00).
 */
const parseShootDateTime = (ngayChup, gioBatDau) => {
  const timePart = gioBatDau.length === 5 ? `${gioBatDau}:00` : gioBatDau;
  return new Date(`${ngayChup}T${timePart}+07:00`);
};

/**
 * Release any expired 15-minute holds and restore any vouchers attached to them.
 */
const releaseExpiredHolds = async () => {
  const nowIso = new Date().toISOString();
  const { data: expiredBookings, error: findErr } = await supabase
    .from('don_dat_lich')
    .select('id, voucher_id')
    .eq('trang_thai_don', 'cho_thanh_toan_coc')
    .lte('thoi_gian_het_han_giu_cho', nowIso);

  if (findErr || !expiredBookings || expiredBookings.length === 0) {
    return 0;
  }

  const expiredIds = expiredBookings.map((b) => b.id);
  await supabase
    .from('don_dat_lich')
    .update({
      trang_thai_don: 'da_huy_mat_coc',
      thoi_gian_het_han_giu_cho: null,
      ghi_chu_noi_bo: 'Tự động hủy do hết hạn giữ chỗ 15 phút',
    })
    .in('id', expiredIds)
    .eq('trang_thai_don', 'cho_thanh_toan_coc');

  const voucherIds = expiredBookings.map((b) => b.voucher_id).filter(Boolean);
  if (voucherIds.length > 0) {
    await supabase
      .from('voucher')
      .update({
        da_su_dung: false,
        don_dat_lich_su_dung_id: null,
        ngay_su_dung: null,
      })
      .in('id', voucherIds)
      .in('don_dat_lich_su_dung_id', expiredIds);
  }

  return expiredIds.length;
};

/**
 * Count active photographers (`nguoi_dung` with `vai_tro = 'tho_chup'` and `trang_thai = true`).
 */
const countActivePhotographers = async () => {
  const { count, error } = await supabase
    .from('nguoi_dung')
    .select('id', { count: 'exact', head: true })
    .eq('vai_tro', 'tho_chup')
    .eq('trang_thai', true);

  if (error) {
    throw new AppError(`Lỗi đếm số lượng nhiếp ảnh gia: ${error.message}`, 500, 'DATABASE_ERROR');
  }
  return count || 0;
};

/**
 * Check whether a booking record currently occupies a room/photographer resource.
 */
const isBookingOccupying = (booking, nowMs = Date.now()) => {
  if (ACTIVE_BOOKING_STATUSES.includes(booking.trang_thai_don)) {
    return true;
  }
  if (booking.trang_thai_don === 'cho_thanh_toan_coc' && booking.thoi_gian_het_han_giu_cho) {
    return new Date(booking.thoi_gian_het_han_giu_cho).getTime() > nowMs;
  }
  return false;
};

/**
 * Compute slot availability for a date & concept (`phong_chup_id`), checking both room & photographer capacity.
 */
const getAvailabilityForDate = async ({ ngayChup, conceptId, excludeBookingId = null }) => {
  await releaseExpiredHolds();

  const { data: concept, error: conceptErr } = await supabase
    .from('concept')
    .select('id, ten_concept, phong_chup_id, trang_thai, phong_chup(id, ten_phong, phong_cach)')
    .eq('id', conceptId)
    .eq('trang_thai', true)
    .maybeSingle();

  if (conceptErr) {
    throw new AppError(`Lỗi truy vấn concept: ${conceptErr.message}`, 500, 'DATABASE_ERROR');
  }
  if (!concept) {
    throw new AppError('Không tìm thấy concept yêu cầu', 404, 'CONCEPT_NOT_FOUND');
  }
  if (!concept.phong_chup_id) {
    throw new AppError('Concept chưa được gắn phòng chụp mặc định', 400, 'CONCEPT_MISSING_ROOM');
  }

  const [{ data: timeSlots, error: slotsErr }, totalPhotographers, { data: dayBookings, error: bookingsErr }] =
    await Promise.all([
      supabase.from('khung_gio_chup').select('*').eq('trang_thai', true).order('gio_bat_dau', { ascending: true }),
      countActivePhotographers(),
      supabase
        .from('don_dat_lich')
        .select('id, phong_chup_id, khung_gio_id, trang_thai_don, thoi_gian_het_han_giu_cho')
        .eq('ngay_chup', ngayChup)
        .in('trang_thai_don', [...ACTIVE_BOOKING_STATUSES, 'cho_thanh_toan_coc']),
    ]);

  if (slotsErr) {
    throw new AppError(`Lỗi truy vấn khung giờ chụp: ${slotsErr.message}`, 500, 'DATABASE_ERROR');
  }
  if (bookingsErr) {
    throw new AppError(`Lỗi truy vấn lịch đặt trong ngày: ${bookingsErr.message}`, 500, 'DATABASE_ERROR');
  }

  const nowMs = Date.now();
  const occupyingBookings = (dayBookings || []).filter(
    (b) => b.id !== excludeBookingId && isBookingOccupying(b, nowMs)
  );

  const slots = (timeSlots || []).map((slot) => {
    const slotStartMs = parseShootDateTime(ngayChup, slot.gio_bat_dau).getTime();
    const isPast = slotStartMs <= nowMs;

    const slotBookings = occupyingBookings.filter((b) => b.khung_gio_id === slot.id);
    const isRoomTaken = slotBookings.some((b) => b.phong_chup_id === concept.phong_chup_id);
    const totalOccupied = slotBookings.length;

    const phongTrong = !isRoomTaken;
    const conTho = totalOccupied < totalPhotographers;
    const khaDung = !isPast && phongTrong && conTho;

    let lyDoHetCho = null;
    if (isPast) {
      lyDoHetCho = 'Khung giờ đã qua';
    } else if (!phongTrong) {
      lyDoHetCho = 'Phòng chụp của concept này đã có đơn đặt';
    } else if (!conTho) {
      lyDoHetCho = 'Đã hết nhiếp ảnh gia rảnh trong ca này';
    }

    return {
      khung_gio_id: slot.id,
      ca_chup: slot.ca_chup,
      gio_bat_dau: slot.gio_bat_dau,
      gio_ket_thuc: slot.gio_ket_thuc,
      kha_dung: khaDung,
      phong_trong: phongTrong,
      con_tho: conTho,
      so_tho_ranh: Math.max(0, totalPhotographers - totalOccupied),
      ly_do_het_cho: lyDoHetCho,
    };
  });

  return {
    ngay_chup: ngayChup,
    concept: {
      id: concept.id,
      ten_concept: concept.ten_concept,
      phong_chup_id: concept.phong_chup_id,
      phong_chup: concept.phong_chup,
    },
    tong_nhiep_anh_gia: totalPhotographers,
    slots,
  };
};

/**
 * Verify a specific slot is currently available; throws 409/400 if unavailable.
 */
const assertSlotAvailable = async ({ ngayChup, conceptId, khungGioId, excludeBookingId = null }) => {
  const availability = await getAvailabilityForDate({ ngayChup, conceptId, excludeBookingId });
  const targetSlot = availability.slots.find((s) => s.khung_gio_id === khungGioId);

  if (!targetSlot) {
    throw new AppError('Khung giờ chụp không tồn tại hoặc đang ngừng hoạt động', 404, 'TIME_SLOT_NOT_FOUND');
  }
  if (!targetSlot.kha_dung) {
    throw new AppError(targetSlot.ly_do_het_cho || 'Khung giờ này đã hết chỗ', 409, 'SLOT_UNAVAILABLE');
  }

  return {
    concept: availability.concept,
    slot: targetSlot,
    totalPhotographers: availability.tong_nhiep_anh_gia,
  };
};

module.exports = {
  ACTIVE_BOOKING_STATUSES,
  HOLDING_DURATION_MS,
  parseShootDateTime,
  releaseExpiredHolds,
  countActivePhotographers,
  isBookingOccupying,
  getAvailabilityForDate,
  assertSlotAvailable,
};
