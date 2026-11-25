const crypto = require('crypto');
const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');
const {
  ACTIVE_BOOKING_STATUSES,
  HOLDING_DURATION_MS,
  parseShootDateTime,
  releaseExpiredHolds,
  isBookingOccupying,
  getAvailabilityForDate,
  assertSlotAvailable,
} = require('../services/slotService');
const { calculateBookingPricing } = require('../services/pricingService');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidDateString = (dateStr) => {
  if (!DATE_REGEX.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(dateStr);
};

const dateSchema = z
  .string({ required_error: 'Vui lòng chọn ngày chụp (YYYY-MM-DD)' })
  .refine(isValidDateString, 'Ngày chụp không hợp lệ, định dạng chuẩn là YYYY-MM-DD');

const addonItemSchema = z.object({
  dich_vu_cong_them_id: z.coerce.number().int().positive('ID dịch vụ cộng thêm không hợp lệ'),
  so_luong: z.coerce.number().int().min(1, 'Số lượng tối thiểu là 1').max(20, 'Số lượng tối đa là 20').default(1),
});

const calculatePriceSchema = z.object({
  goi_dich_vu_id: z.coerce.number().int().positive('Vui lòng chọn gói dịch vụ'),
  dich_vu_them: z.array(addonItemSchema).optional().default([]),
  ma_voucher: z.string().trim().optional().nullable(),
});

const createBookingSchema = z.object({
  concept_id: z.coerce.number().int().positive('Vui lòng chọn concept'),
  goi_dich_vu_id: z.coerce.number().int().positive('Vui lòng chọn gói dịch vụ'),
  khung_gio_id: z.coerce.number().int().positive('Vui lòng chọn khung giờ chụp'),
  ngay_chup: dateSchema,
  dich_vu_them: z.array(addonItemSchema).optional().default([]),
  ma_voucher: z.string().trim().optional().nullable(),
  ghi_chu_khach_hang: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự').optional().nullable(),
});

const payDepositSchema = z.object({
  hinh_thuc: z.enum(['chuyen_khoan', 'tien_mat']).optional().default('chuyen_khoan'),
  ma_giao_dich: z.string().trim().max(100).optional().nullable(),
});

const rescheduleSchema = z.object({
  ngay_chup: dateSchema,
  khung_gio_id: z.coerce.number().int().positive('Vui lòng chọn khung giờ mới'),
});

const cancelSchema = z.object({
  phuong_an: z.enum(['voucher_100', 'hoan_tien_50']).optional().default('voucher_100'),
});

const BOOKING_DETAIL_SELECT = `
  *,
  concept:concept_id ( id, ten_concept, duong_dan_concept, hinh_dai_dien ),
  phong_chup:phong_chup_id ( id, ten_phong, phong_cach ),
  goi_dich_vu:goi_dich_vu_id ( id, ten_goi, ma_goi, gia_co_ban, thoi_luong_phut, so_anh_chinh_sua, so_trang_phuc_toi_da ),
  khung_gio_chup:khung_gio_id ( id, ca_chup, gio_bat_dau, gio_ket_thuc ),
  khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten, email, so_dien_thoai ),
  tho_chup:nguoi_dung!tho_chup_id ( id, ho_ten, email, so_dien_thoai ),
  chi_tiet_dich_vu_them (
    id,
    dich_vu_cong_them_id,
    so_luong,
    don_gia,
    thanh_tien,
    dich_vu_cong_them ( id, ten_dich_vu, don_vi_tinh )
  )
`;

const generateCode = (prefix) => {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${ym}-${suffix}`;
};

const buildQrPaymentInfo = (booking) => ({
  ma_don: booking.ma_don,
  so_tien_coc: Number(booking.tien_coc),
  noi_dung_chuyen_khoan: booking.ma_don,
  het_han_giu_cho: booking.thoi_gian_het_han_giu_cho,
  ngan_hang: process.env.STUDIO_BANK_NAME || 'MB Bank',
  so_tai_khoan: process.env.STUDIO_BANK_ACCOUNT || '0123456789',
  chu_tai_khoan: process.env.STUDIO_BANK_HOLDER || 'BO PHOTO STUDIO',
});

const parsePositiveId = (rawId, label = 'ID đơn đặt lịch') => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${label} không hợp lệ`, 400, 'INVALID_ID');
  }
  return id;
};

/**
 * Fetch a booking and enforce owner/admin authorization.
 */
const getAuthorizedBooking = async (bookingId, user, { allowAdmin = true } = {}) => {
  await releaseExpiredHolds();

  const { data: booking, error } = await supabase
    .from('don_dat_lich')
    .select(BOOKING_DETAIL_SELECT)
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    throw new AppError(`Lỗi truy vấn đơn đặt lịch: ${error.message}`, 500, 'DATABASE_ERROR');
  }
  if (!booking) {
    throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');
  }

  const isOwner = booking.khach_hang_id === user.id;
  const isAdmin = allowAdmin && user.vai_tro === 'quan_tri_vien';
  if (!isOwner && !isAdmin) {
    throw new AppError('Bạn không có quyền truy cập đơn đặt lịch này', 403, 'FORBIDDEN');
  }

  return booking;
};

/**
 * Rollback a newly inserted booking if concurrency/voucher checks fail mid-flight.
 */
const rollbackBooking = async (bookingId) => {
  await supabase.from('chi_tiet_dich_vu_them').delete().eq('don_dat_lich_id', bookingId);
  await supabase.from('don_dat_lich').delete().eq('id', bookingId);
};

/**
 * GET /api/bookings/availability?ngay_chup=YYYY-MM-DD&concept_id=1
 */
const getAvailability = async (req, res, next) => {
  try {
    const querySchema = z.object({
      ngay_chup: dateSchema,
      concept_id: z.coerce.number().int().positive('Vui lòng chọn concept'),
    });
    const parsed = querySchema.parse(req.query);

    const data = await getAvailabilityForDate({
      ngayChup: parsed.ngay_chup,
      conceptId: parsed.concept_id,
    });

    return sendSuccess(res, {
      message: 'Kiểm tra lịch trống thành công',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/bookings/calculate-price
 */
const calculatePrice = async (req, res, next) => {
  try {
    const parsed = calculatePriceSchema.parse(req.body);
    const pricing = await calculateBookingPricing({
      goiDichVuId: parsed.goi_dich_vu_id,
      dichVuThem: parsed.dich_vu_them,
      maVoucher: parsed.ma_voucher,
      khachHangId: req.user ? req.user.id : null,
    });

    return sendSuccess(res, {
      message: 'Tính chi phí dự kiến thành công',
      data: {
        gia_goi: pricing.gia_goi,
        tong_tien_dich_vu_them: pricing.tong_tien_dich_vu_them,
        gia_goc: pricing.gia_goc,
        tien_giam_voucher: pricing.tien_giam_voucher,
        tong_tien: pricing.tong_tien,
        tien_coc: pricing.tien_coc,
        tien_con_lai: pricing.tien_con_lai,
        chi_tiet_dich_vu_them: pricing.chi_tiet_dich_vu_them,
        voucher_ap_dung: pricing.voucher
          ? {
              id: pricing.voucher.id,
              ma_voucher: pricing.voucher.ma_voucher,
              gia_tri: Number(pricing.voucher.gia_tri),
              han_su_dung: pricing.voucher.han_su_dung,
            }
          : null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/bookings
 * Create a booking with 15-minute slot hold (or immediate confirmation if 100% covered by voucher).
 */
const createBooking = async (req, res, next) => {
  try {
    const parsed = createBookingSchema.parse(req.body);

    const [{ concept, totalPhotographers }, pricing] = await Promise.all([
      assertSlotAvailable({
        ngayChup: parsed.ngay_chup,
        conceptId: parsed.concept_id,
        khungGioId: parsed.khung_gio_id,
      }),
      calculateBookingPricing({
        goiDichVuId: parsed.goi_dich_vu_id,
        dichVuThem: parsed.dich_vu_them,
        maVoucher: parsed.ma_voucher,
        khachHangId: req.user.id,
      }),
    ]);

    const maDon = generateCode('BK');
    const isZeroDeposit = pricing.tien_coc === 0;
    const holdExpiresAt = isZeroDeposit ? null : new Date(Date.now() + HOLDING_DURATION_MS).toISOString();

    const { data: createdBooking, error: insertErr } = await supabase
      .from('don_dat_lich')
      .insert([
        {
          ma_don: maDon,
          khach_hang_id: req.user.id,
          phong_chup_id: concept.phong_chup_id,
          concept_id: parsed.concept_id,
          goi_dich_vu_id: parsed.goi_dich_vu_id,
          khung_gio_id: parsed.khung_gio_id,
          ngay_chup: parsed.ngay_chup,
          tong_tien: pricing.tong_tien,
          tien_coc: pricing.tien_coc,
          tien_con_lai: pricing.tien_con_lai,
          voucher_id: pricing.voucher ? pricing.voucher.id : null,
          tien_giam_voucher: pricing.tien_giam_voucher,
          trang_thai_don: isZeroDeposit ? 'da_coc' : 'cho_thanh_toan_coc',
          trang_thai_thanh_toan: isZeroDeposit ? 'da_thanh_toan_coc' : 'chua_thanh_toan',
          so_lan_doi_lich: 0,
          thoi_gian_het_han_giu_cho: holdExpiresAt,
          ghi_chu_khach_hang: parsed.ghi_chu_khach_hang || null,
        },
      ])
      .select('*')
      .single();

    if (insertErr) {
      throw new AppError(`Không thể tạo đơn đặt lịch: ${insertErr.message}`, 400, 'CREATE_BOOKING_FAILED');
    }

    // Optimistic concurrency guard: verify this insert didn't exceed room or photographer capacity
    const { data: slotBookings, error: checkErr } = await supabase
      .from('don_dat_lich')
      .select('id, phong_chup_id, trang_thai_don, thoi_gian_het_han_giu_cho')
      .eq('ngay_chup', parsed.ngay_chup)
      .eq('khung_gio_id', parsed.khung_gio_id)
      .in('trang_thai_don', [...ACTIVE_BOOKING_STATUSES, 'cho_thanh_toan_coc'])
      .order('id', { ascending: true });

    if (checkErr) {
      await rollbackBooking(createdBooking.id);
      throw new AppError(`Lỗi kiểm tra xung đột lịch: ${checkErr.message}`, 500, 'DATABASE_ERROR');
    }

    const nowMs = Date.now();
    const activeSlotBookings = (slotBookings || []).filter((b) => isBookingOccupying(b, nowMs));
    const roomWinners = activeSlotBookings.filter((b) => b.phong_chup_id === concept.phong_chup_id);
    const lostRoomRace = roomWinners.length > 1 && roomWinners[0].id !== createdBooking.id;
    const lostPhotographerRace =
      activeSlotBookings.length > totalPhotographers &&
      activeSlotBookings.findIndex((b) => b.id === createdBooking.id) >= totalPhotographers;

    if (lostRoomRace || lostPhotographerRace) {
      await rollbackBooking(createdBooking.id);
      throw new AppError('Khung giờ này vừa được khách hàng khác giữ chỗ, vui lòng chọn ca khác', 409, 'SLOT_JUST_TAKEN');
    }

    // Atomically lock voucher if used
    if (pricing.voucher) {
      const { data: claimedVoucher, error: vClaimErr } = await supabase
        .from('voucher')
        .update({
          da_su_dung: true,
          don_dat_lich_su_dung_id: createdBooking.id,
          ngay_su_dung: new Date().toISOString(),
        })
        .eq('id', pricing.voucher.id)
        .eq('da_su_dung', false)
        .select('id')
        .maybeSingle();

      if (vClaimErr || !claimedVoucher) {
        await rollbackBooking(createdBooking.id);
        throw new AppError('Voucher vừa được sử dụng ở một giao dịch khác', 409, 'VOUCHER_ALREADY_USED');
      }
    }

    // Insert add-on line items
    if (pricing.chi_tiet_dich_vu_them.length > 0) {
      const addonRows = pricing.chi_tiet_dich_vu_them.map((item) => ({
        don_dat_lich_id: createdBooking.id,
        dich_vu_cong_them_id: item.dich_vu_cong_them_id,
        so_luong: item.so_luong,
        don_gia: item.don_gia,
        thanh_tien: item.thanh_tien,
      }));
      const { error: addonInsertErr } = await supabase.from('chi_tiet_dich_vu_them').insert(addonRows);
      if (addonInsertErr) {
        await rollbackBooking(createdBooking.id);
        throw new AppError(`Lỗi lưu dịch vụ cộng thêm: ${addonInsertErr.message}`, 500, 'DATABASE_ERROR');
      }
    }

    const fullBooking = await getAuthorizedBooking(createdBooking.id, req.user);

    return sendSuccess(res, {
      statusCode: 201,
      message: isZeroDeposit
        ? 'Đặt lịch thành công và đã được xác nhận bằng voucher'
        : 'Đặt lịch thành công! Vui lòng thanh toán tiền cọc 30% trong vòng 15 phút để giữ chỗ',
      data: {
        booking: fullBooking,
        thong_tin_chuyen_khoan: isZeroDeposit ? null : buildQrPaymentInfo(fullBooking),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/bookings/:id/pay-deposit
 * Confirm 30% deposit payment for a booking still inside its 15-minute holding window.
 */
const payDeposit = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id);
    const parsed = payDepositSchema.parse(req.body || {});
    const booking = await getAuthorizedBooking(bookingId, req.user);

    if (booking.trang_thai_don === 'da_coc') {
      throw new AppError('Đơn đặt lịch này đã được thanh toán cọc trước đó', 400, 'ALREADY_DEPOSITED');
    }
    if (
      booking.trang_thai_don === 'da_huy_mat_coc' &&
      (booking.ghi_chu_noi_bo || '').includes('hết hạn giữ chỗ')
    ) {
      throw new AppError('Đơn đặt lịch đã hết thời gian giữ chỗ 15 phút, vui lòng đặt lại', 400, 'HOLD_EXPIRED');
    }
    if (booking.trang_thai_don !== 'cho_thanh_toan_coc') {
      throw new AppError('Trạng thái đơn hiện tại không thể thanh toán cọc', 400, 'INVALID_BOOKING_STATUS');
    }

    const maGiaoDich = parsed.ma_giao_dich || generateCode('TXN');
    const { error: payErr } = await supabase.from('lich_su_thanh_toan').insert([
      {
        don_dat_lich_id: booking.id,
        loai_thanh_toan: 'tien_coc_30',
        so_tien: booking.tien_coc,
        hinh_thuc: parsed.hinh_thuc,
        ma_giao_dich: maGiaoDich,
        trang_thai: 'thanh_cong',
      },
    ]);

    if (payErr) {
      throw new AppError(`Lỗi ghi nhận lịch sử thanh toán: ${payErr.message}`, 500, 'DATABASE_ERROR');
    }

    const { error: updateErr } = await supabase
      .from('don_dat_lich')
      .update({
        trang_thai_don: 'da_coc',
        trang_thai_thanh_toan: 'da_thanh_toan_coc',
        thoi_gian_het_han_giu_cho: null,
      })
      .eq('id', booking.id);

    if (updateErr) {
      throw new AppError(`Lỗi cập nhật trạng thái đơn: ${updateErr.message}`, 500, 'DATABASE_ERROR');
    }

    const updated = await getAuthorizedBooking(booking.id, req.user);
    return sendSuccess(res, {
      message: 'Xác nhận thanh toán cọc 30% thành công',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/bookings/my-bookings?trang_thai_don=
 */
const getMyBookings = async (req, res, next) => {
  try {
    await releaseExpiredHolds();

    let query = supabase
      .from('don_dat_lich')
      .select(BOOKING_DETAIL_SELECT)
      .eq('khach_hang_id', req.user.id)
      .order('ngay_tao', { ascending: false });

    if (req.query.trang_thai_don) {
      query = query.eq('trang_thai_don', String(req.query.trang_thai_don).trim());
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Lỗi lấy danh sách đơn đặt lịch: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Lấy lịch sử đặt lịch thành công',
      data: data || [],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/bookings/my-vouchers
 */
const getMyVouchers = async (req, res, next) => {
  try {
    await releaseExpiredHolds();

    const { data, error } = await supabase
      .from('voucher')
      .select('*')
      .eq('khach_hang_id', req.user.id)
      .order('ngay_tao', { ascending: false });

    if (error) {
      throw new AppError(`Lỗi lấy danh sách voucher: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    const nowMs = Date.now();
    const enriched = (data || []).map((v) => ({
      ...v,
      con_hieu_luc: !v.da_su_dung && new Date(v.han_su_dung).getTime() > nowMs,
    }));

    return sendSuccess(res, {
      message: 'Lấy danh sách voucher thành công',
      data: enriched,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/bookings/:id
 */
const getBookingDetail = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id);
    const booking = await getAuthorizedBooking(bookingId, req.user);

    const { data: payments, error: payErr } = await supabase
      .from('lich_su_thanh_toan')
      .select('*')
      .eq('don_dat_lich_id', booking.id)
      .order('ngay_thanh_toan', { ascending: true });

    if (payErr) {
      throw new AppError(`Lỗi lấy lịch sử thanh toán: ${payErr.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Lấy chi tiết đơn đặt lịch thành công',
      data: {
        ...booking,
        lich_su_thanh_toan: payments || [],
        thong_tin_chuyen_khoan:
          booking.trang_thai_don === 'cho_thanh_toan_coc' ? buildQrPaymentInfo(booking) : null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/bookings/:id/reschedule
 * Allow 1 free reschedule when >= 24h before current shoot time.
 */
const rescheduleBooking = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id);
    const parsed = rescheduleSchema.parse(req.body);
    const booking = await getAuthorizedBooking(bookingId, req.user, { allowAdmin: false });

    if (booking.trang_thai_don !== 'da_coc') {
      throw new AppError('Chỉ có thể đổi lịch cho đơn đã đặt cọc thành công', 400, 'INVALID_BOOKING_STATUS');
    }
    if ((booking.so_lan_doi_lich || 0) >= 1) {
      throw new AppError('Đơn đặt lịch này đã sử dụng hết 01 lần đổi lịch miễn phí', 400, 'RESCHEDULE_LIMIT_REACHED');
    }
    if (booking.ngay_chup === parsed.ngay_chup && booking.khung_gio_id === parsed.khung_gio_id) {
      throw new AppError('Ngày chụp và khung giờ mới trùng với lịch hiện tại', 400, 'SAME_SLOT');
    }

    const oldShootTimeMs = parseShootDateTime(booking.ngay_chup, booking.khung_gio_chup.gio_bat_dau).getTime();
    const hoursUntilShoot = (oldShootTimeMs - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilShoot < 24) {
      throw new AppError(
        'Đã quá hạn tự đổi lịch (dưới 24 giờ trước giờ chụp). Vui lòng liên hệ hotline studio để được hỗ trợ',
        400,
        'RESCHEDULE_DEADLINE_PASSED'
      );
    }

    await assertSlotAvailable({
      ngayChup: parsed.ngay_chup,
      conceptId: booking.concept_id,
      khungGioId: parsed.khung_gio_id,
      excludeBookingId: booking.id,
    });

    const { error: updateErr } = await supabase
      .from('don_dat_lich')
      .update({
        ngay_chup: parsed.ngay_chup,
        khung_gio_id: parsed.khung_gio_id,
        so_lan_doi_lich: (booking.so_lan_doi_lich || 0) + 1,
      })
      .eq('id', booking.id);

    if (updateErr) {
      throw new AppError(`Không thể đổi lịch: ${updateErr.message}`, 500, 'DATABASE_ERROR');
    }

    const updated = await getAuthorizedBooking(booking.id, req.user);
    return sendSuccess(res, {
      message: 'Đổi lịch chụp thành công! Tiền cọc 30% đã được bảo lưu sang lịch mới',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/bookings/:id/cancel
 * Cancel a booking:
 * - If unpaid (`cho_thanh_toan_coc`): cancels & releases any attached voucher.
 * - If deposited (`da_coc`) and >= 48h before shoot: refunds 50% or issues 100% 6-month voucher.
 * - If deposited (`da_coc`) and < 48h before shoot: forfeits 100% deposit (`huy_mat_coc`).
 */
const cancelBooking = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id);
    const parsed = cancelSchema.parse(req.body || {});
    const booking = await getAuthorizedBooking(bookingId, req.user, { allowAdmin: false });

    if (!['cho_thanh_toan_coc', 'da_coc'].includes(booking.trang_thai_don)) {
      throw new AppError('Đơn đặt lịch hiện tại không thể hủy', 400, 'INVALID_BOOKING_STATUS');
    }

    // Unpaid hold cancellation: simply cancel and release voucher if attached
    if (booking.trang_thai_don === 'cho_thanh_toan_coc') {
      const { error: cancelUnpaidErr } = await supabase
        .from('don_dat_lich')
        .update({
          trang_thai_don: 'da_huy_mat_coc',
          thoi_gian_het_han_giu_cho: null,
          ghi_chu_noi_bo: 'Khách hủy đơn trước khi thanh toán cọc',
        })
        .eq('id', booking.id);

      if (cancelUnpaidErr) {
        throw new AppError(`Lỗi hủy đơn: ${cancelUnpaidErr.message}`, 500, 'DATABASE_ERROR');
      }

      if (booking.voucher_id) {
        await supabase
          .from('voucher')
          .update({ da_su_dung: false, don_dat_lich_su_dung_id: null, ngay_su_dung: null })
          .eq('id', booking.voucher_id)
          .eq('don_dat_lich_su_dung_id', booking.id);
      }

      const updated = await getAuthorizedBooking(booking.id, req.user);
      return sendSuccess(res, {
        message: 'Đã hủy đơn đặt lịch chưa thanh toán cọc',
        data: { booking: updated, voucher: null, so_tien_hoan: 0 },
      });
    }

    // Deposited booking cancellation: check 48-hour threshold
    const shootTimeMs = parseShootDateTime(booking.ngay_chup, booking.khung_gio_chup.gio_bat_dau).getTime();
    const hoursUntilShoot = (shootTimeMs - Date.now()) / (1000 * 60 * 60);

    if (hoursUntilShoot < 48) {
      const { error: noRefundErr } = await supabase
        .from('don_dat_lich')
        .update({
          trang_thai_don: 'da_huy_mat_coc',
          ghi_chu_noi_bo: 'Khách hủy lịch dưới 48 giờ trước giờ chụp (mất 100% cọc)',
        })
        .eq('id', booking.id);

      if (noRefundErr) {
        throw new AppError(`Lỗi hủy đơn: ${noRefundErr.message}`, 500, 'DATABASE_ERROR');
      }

      const updated = await getAuthorizedBooking(booking.id, req.user);
      return sendSuccess(res, {
        message: 'Đã hủy lịch (dưới 48 giờ trước giờ chụp nên không hoàn lại tiền cọc)',
        data: { booking: updated, voucher: null, so_tien_hoan: 0 },
      });
    }

    // >= 48 hours: either 100% deposit voucher (6 months) or 50% cash refund
    const depositAmount = Number(booking.tien_coc);
    let createdVoucher = null;
    let refundAmount = 0;
    let cancelNote = 'Khách hủy lịch trước 48 giờ';

    if (parsed.phuong_an === 'voucher_100' && depositAmount > 0) {
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 6);

      const { data: voucher, error: vErr } = await supabase
        .from('voucher')
        .insert([
          {
            ma_voucher: generateCode('VCH'),
            khach_hang_id: booking.khach_hang_id,
            don_dat_lich_goc_id: booking.id,
            gia_tri: depositAmount,
            han_su_dung: expiryDate.toISOString(),
            da_su_dung: false,
          },
        ])
        .select('*')
        .single();

      if (vErr) {
        throw new AppError(`Lỗi tạo voucher bảo lưu cọc: ${vErr.message}`, 500, 'DATABASE_ERROR');
      }
      createdVoucher = voucher;
      cancelNote = `Khách hủy lịch trước 48 giờ - Đã cấp voucher ${voucher.ma_voucher} (${depositAmount} VNĐ)`;
    } else if (parsed.phuong_an === 'hoan_tien_50' && depositAmount > 0) {
      refundAmount = Math.round(depositAmount * 0.5);
      cancelNote = `Khách hủy lịch trước 48 giờ - Hoàn trả 50% cọc (${refundAmount} VNĐ)`;
    }

    const { error: cancelOkErr } = await supabase
      .from('don_dat_lich')
      .update({
        trang_thai_don: 'da_huy_hoan_coc',
        ghi_chu_noi_bo: cancelNote,
      })
      .eq('id', booking.id);

    if (cancelOkErr) {
      throw new AppError(`Lỗi cập nhật trạng thái hủy đơn: ${cancelOkErr.message}`, 500, 'DATABASE_ERROR');
    }

    const updated = await getAuthorizedBooking(booking.id, req.user);
    return sendSuccess(res, {
      message:
        createdVoucher
          ? 'Hủy lịch thành công! Hệ thống đã cấp Voucher bảo lưu 100% tiền cọc có hạn dùng 6 tháng'
          : 'Hủy lịch thành công! Studio đã ghi nhận hoàn trả 50% tiền cọc',
      data: {
        booking: updated,
        voucher: createdVoucher,
        so_tien_hoan: refundAmount,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAvailability,
  calculatePrice,
  createBooking,
  payDeposit,
  getMyBookings,
  getMyVouchers,
  getBookingDetail,
  rescheduleBooking,
  cancelBooking,
};
