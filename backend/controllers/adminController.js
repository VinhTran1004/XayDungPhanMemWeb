const crypto = require('crypto');
const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');
const { ACTIVE_BOOKING_STATUSES, releaseExpiredHolds, assertSlotAvailable } = require('../services/slotService');
const { calculateBookingPricing } = require('../services/pricingService');
const { uploadBufferToStorage, resolveStorageUrls } = require('../services/storageService');

const BOOKING_STATUS_ENUM = [
  'cho_thanh_toan_coc',
  'da_coc',
  'dang_chup',
  'cho_chon_anh',
  'dang_chinh_sua',
  'hoan_thanh',
  'da_huy_hoan_coc',
  'da_huy_mat_coc',
];

// Map Frontend shorthand aliases smoothly onto DB CHECK constraint values
const STATUS_ALIAS_MAP = {
  da_phan_cong: 'da_coc',
  da_chup: 'cho_chon_anh',
  da_chot_anh: 'dang_chinh_sua',
  da_hoan_thanh: 'hoan_thanh',
};

const normalizeBookingStatus = (raw) => STATUS_ALIAS_MAP[raw] || raw;

const ADMIN_BOOKING_SELECT = `
  *,
  concept:concept_id ( id, ten_concept, hinh_dai_dien ),
  phong_chup:phong_chup_id ( id, ten_phong, phong_cach ),
  goi_dich_vu:goi_dich_vu_id ( id, ten_goi, ma_goi, gia_co_ban, so_anh_chinh_sua ),
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

const attachBookingCompatFields = (b) =>
  b
    ? {
        ...b,
        khung_gio: b.khung_gio_chup || null,
      }
    : null;

const parsePositiveId = (rawId, label = 'ID') => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${label} không hợp lệ`, 400, 'INVALID_ID');
  }
  return id;
};

const generateTxnCode = (prefix) => {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${prefix}-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

// ============================================================================
// 1. QUẢN TRỊ ĐƠN ĐẶT LỊCH FULL CRUD (/api/admin/bookings)
// ============================================================================

/**
 * GET /api/admin/bookings
 */
const getAdminBookings = async (req, res, next) => {
  try {
    await releaseExpiredHolds();

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('don_dat_lich')
      .select(ADMIN_BOOKING_SELECT, { count: 'exact' })
      .order('ngay_chup', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (req.query.ngay_chup) query = query.eq('ngay_chup', String(req.query.ngay_chup).trim());
    if (req.query.phong_chup_id) query = query.eq('phong_chup_id', Number(req.query.phong_chup_id));
    if (req.query.tho_chup_id) query = query.eq('tho_chup_id', Number(req.query.tho_chup_id));
    if (req.query.trang_thai_don) {
      query = query.eq('trang_thai_don', normalizeBookingStatus(String(req.query.trang_thai_don).trim()));
    }
    if (req.query.trang_thai_thanh_toan) {
      query = query.eq('trang_thai_thanh_toan', String(req.query.trang_thai_thanh_toan).trim());
    }
    if (req.query.ma_don) query = query.ilike('ma_don', `%${String(req.query.ma_don).trim()}%`);

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(`Lỗi truy vấn danh sách đơn: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Lấy danh sách đơn đặt lịch thành công',
      data: (data || []).map(attachBookingCompatFields),
      meta: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/bookings/:id
 */
const getAdminBookingDetail = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');

    const [{ data: booking, error: bErr }, { data: payments }, { data: album }] = await Promise.all([
      supabase.from('don_dat_lich').select(ADMIN_BOOKING_SELECT).eq('id', bookingId).maybeSingle(),
      supabase.from('lich_su_thanh_toan').select('*').eq('don_dat_lich_id', bookingId).order('ngay_thanh_toan'),
      supabase.from('album').select('*').eq('don_dat_lich_id', bookingId).maybeSingle(),
    ]);

    if (bErr) throw new AppError(bErr.message, 500, 'DATABASE_ERROR');
    if (!booking) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    return sendSuccess(res, {
      message: 'Lấy chi tiết đơn đặt lịch thành công',
      data: {
        ...attachBookingCompatFields(booking),
        lich_su_thanh_toan: payments || [],
        album: album || null,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/bookings
 * Cho phép Admin tạo đơn đặt lịch trực tiếp cho khách tại quầy / qua hotline.
 */
const createAdminBooking = async (req, res, next) => {
  try {
    const schema = z.object({
      khach_hang_id: z.coerce.number().int().positive('Vui lòng chọn khách hàng'),
      concept_id: z.coerce.number().int().positive('Vui lòng chọn concept'),
      goi_dich_vu_id: z.coerce.number().int().positive('Vui lòng chọn gói dịch vụ'),
      khung_gio_id: z.coerce.number().int().positive('Vui lòng chọn khung giờ'),
      ngay_chup: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày chụp phải có định dạng YYYY-MM-DD'),
      tho_chup_id: z.coerce.number().int().positive().optional().nullable(),
      dich_vu_them: z
        .array(
          z.object({
            dich_vu_cong_them_id: z.coerce.number().int().positive(),
            so_luong: z.coerce.number().int().min(1).max(20).default(1),
          })
        )
        .optional()
        .default([]),
      da_thu_coc: z.boolean().optional().default(true),
      ghi_chu_khach_hang: z.string().trim().max(1000).optional().nullable(),
      ghi_chu_noi_bo: z.string().trim().max(1000).optional().nullable(),
    });
    const parsed = schema.parse(req.body);

    const [{ concept }, pricing] = await Promise.all([
      assertSlotAvailable({
        ngayChup: parsed.ngay_chup,
        conceptId: parsed.concept_id,
        khungGioId: parsed.khung_gio_id,
      }),
      calculateBookingPricing({
        goiDichVuId: parsed.goi_dich_vu_id,
        dichVuThem: parsed.dich_vu_them,
      }),
    ]);

    const maDon = generateTxnCode('BK');
    const isDeposited = Boolean(parsed.da_thu_coc);

    const { data: created, error: insErr } = await supabase
      .from('don_dat_lich')
      .insert([
        {
          ma_don: maDon,
          khach_hang_id: parsed.khach_hang_id,
          tho_chup_id: parsed.tho_chup_id || null,
          phong_chup_id: concept.phong_chup_id,
          concept_id: parsed.concept_id,
          goi_dich_vu_id: parsed.goi_dich_vu_id,
          khung_gio_id: parsed.khung_gio_id,
          ngay_chup: parsed.ngay_chup,
          tong_tien: pricing.tong_tien,
          tien_coc: pricing.tien_coc,
          tien_con_lai: pricing.tien_con_lai,
          trang_thai_don: isDeposited ? 'da_coc' : 'cho_thanh_toan_coc',
          trang_thai_thanh_toan: isDeposited ? 'da_thanh_toan_coc' : 'chua_thanh_toan',
          ghi_chu_khach_hang: parsed.ghi_chu_khach_hang || null,
          ghi_chu_noi_bo: parsed.ghi_chu_noi_bo || 'Đơn tạo trực tiếp bởi Quản trị viên',
        },
      ])
      .select('*')
      .single();

    if (insErr) throw new AppError(`Lỗi tạo đơn đặt lịch: ${insErr.message}`, 400, 'CREATE_BOOKING_FAILED');

    if (pricing.chi_tiet_dich_vu_them.length > 0) {
      const addonRows = pricing.chi_tiet_dich_vu_them.map((item) => ({
        don_dat_lich_id: created.id,
        dich_vu_cong_them_id: item.dich_vu_cong_them_id,
        so_luong: item.so_luong,
        don_gia: item.don_gia,
        thanh_tien: item.thanh_tien,
      }));
      await supabase.from('chi_tiet_dich_vu_them').insert(addonRows);
    }

    if (isDeposited && pricing.tien_coc > 0) {
      await supabase.from('lich_su_thanh_toan').insert([
        {
          don_dat_lich_id: created.id,
          loai_thanh_toan: 'tien_coc_30',
          so_tien: pricing.tien_coc,
          hinh_thuc: 'tien_mat',
          ma_giao_dich: generateTxnCode('DEP'),
          trang_thai: 'thanh_cong',
        },
      ]);
    }

    const { data: full } = await supabase
      .from('don_dat_lich')
      .select(ADMIN_BOOKING_SELECT)
      .eq('id', created.id)
      .single();

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Admin tạo đơn đặt lịch thành công',
      data: attachBookingCompatFields(full),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH / PUT /api/admin/bookings/:id
 * Admin chỉnh sửa thông tin đơn đặt lịch (bao gồm đổi lịch thủ công dưới 24h theo BRD mục 5.2).
 */
const updateAdminBooking = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');
    const schema = z.object({
      ngay_chup: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      khung_gio_id: z.coerce.number().int().positive().optional(),
      concept_id: z.coerce.number().int().positive().optional(),
      phong_chup_id: z.coerce.number().int().positive().optional(),
      goi_dich_vu_id: z.coerce.number().int().positive().optional(),
      tho_chup_id: z.coerce.number().int().positive().optional().nullable(),
      trang_thai_don: z.string().trim().optional(),
      trang_thai_thanh_toan: z.enum(['chua_thanh_toan', 'da_thanh_toan_coc', 'da_thanh_toan_du']).optional(),
      ghi_chu_khach_hang: z.string().trim().max(1000).optional().nullable(),
      ghi_chu_noi_bo: z.string().trim().max(1000).optional().nullable(),
    });
    const parsed = schema.parse(req.body);

    if (Object.keys(parsed).length === 0) {
      throw new AppError('Không có dữ liệu cần cập nhật', 400, 'EMPTY_UPDATE');
    }

    const { data: current, error: findErr } = await supabase
      .from('don_dat_lich')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (findErr) throw new AppError(findErr.message, 500, 'DATABASE_ERROR');
    if (!current) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    const updatePayload = { ...parsed };
    if (updatePayload.trang_thai_don) {
      const normalized = normalizeBookingStatus(updatePayload.trang_thai_don);
      if (!BOOKING_STATUS_ENUM.includes(normalized)) {
        throw new AppError('Trạng thái đơn không hợp lệ', 400, 'INVALID_BOOKING_STATUS');
      }
      updatePayload.trang_thai_don = normalized;
    }

    // If date, slot, or concept changes, verify room/photographer slot availability
    const nextDate = updatePayload.ngay_chup || current.ngay_chup;
    const nextSlot = updatePayload.khung_gio_id || current.khung_gio_id;
    const nextConcept = updatePayload.concept_id || current.concept_id;
    if (
      nextDate !== current.ngay_chup ||
      nextSlot !== current.khung_gio_id ||
      nextConcept !== current.concept_id
    ) {
      const { concept } = await assertSlotAvailable({
        ngayChup: nextDate,
        conceptId: nextConcept,
        khungGioId: nextSlot,
        excludeBookingId: bookingId,
      });
      if (!updatePayload.phong_chup_id) {
        updatePayload.phong_chup_id = concept.phong_chup_id;
      }
    }

    const { data: updated, error: upErr } = await supabase
      .from('don_dat_lich')
      .update(updatePayload)
      .eq('id', bookingId)
      .select(ADMIN_BOOKING_SELECT)
      .single();

    if (upErr) throw new AppError(`Lỗi cập nhật đơn đặt lịch: ${upErr.message}`, 400, 'UPDATE_BOOKING_FAILED');

    return sendSuccess(res, {
      message: 'Cập nhật thông tin đơn đặt lịch thành công',
      data: attachBookingCompatFields(updated),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/bookings/:id?hard=true
 * Mặc định hủy đơn (`da_huy_mat_coc`); nếu `?hard=true` thì xóa hẳn đơn cùng chi tiết liên quan.
 */
const deleteAdminBooking = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');
    const isHardDelete = String(req.query.hard || '').toLowerCase() === 'true';

    if (isHardDelete) {
      await supabase.from('lich_su_thanh_toan').delete().eq('don_dat_lich_id', bookingId);
      await supabase.from('chi_tiet_dich_vu_them').delete().eq('don_dat_lich_id', bookingId);
      const { data: deleted, error: delErr } = await supabase
        .from('don_dat_lich')
        .delete()
        .eq('id', bookingId)
        .select('*')
        .maybeSingle();

      if (delErr) {
        throw new AppError(
          `Không thể xóa vĩnh viễn đơn này do đang có album hoặc voucher liên kết (${delErr.message})`,
          409,
          'FOREIGN_KEY_CONFLICT'
        );
      }
      if (!deleted) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');
      return sendSuccess(res, { message: 'Đã xóa vĩnh viễn đơn đặt lịch', data: deleted });
    }

    const { data: cancelled, error } = await supabase
      .from('don_dat_lich')
      .update({
        trang_thai_don: 'da_huy_mat_coc',
        thoi_gian_het_han_giu_cho: null,
        ghi_chu_noi_bo: 'Đơn bị hủy bởi Quản trị viên',
      })
      .eq('id', bookingId)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(error.message, 400, 'CANCEL_BOOKING_FAILED');
    if (!cancelled) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    return sendSuccess(res, { message: 'Đã hủy đơn đặt lịch thành công', data: cancelled });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/photographers
 */
const getPhotographers = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('nguoi_dung')
      .select('id, ho_ten, email, so_dien_thoai, anh_dai_dien, trang_thai, ngay_tao')
      .eq('vai_tro', 'tho_chup')
      .order('id', { ascending: true });

    if (error) {
      throw new AppError(`Lỗi lấy danh sách nhiếp ảnh gia: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Lấy danh sách nhiếp ảnh gia thành công',
      data: data || [],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/admin/bookings/:id/confirm-deposit
 */
const confirmDeposit = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');
    const schema = z.object({
      hinh_thuc: z.enum(['chuyen_khoan', 'tien_mat']).optional().default('chuyen_khoan'),
      ma_giao_dich: z.string().trim().max(100).optional().nullable(),
    });
    const parsed = schema.parse(req.body || {});

    const { data: booking, error } = await supabase
      .from('don_dat_lich')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500, 'DATABASE_ERROR');
    if (!booking) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    if (booking.trang_thai_don !== 'cho_thanh_toan_coc') {
      throw new AppError('Đơn này không ở trạng thái chờ thanh toán cọc', 400, 'INVALID_BOOKING_STATUS');
    }

    const { error: payErr } = await supabase.from('lich_su_thanh_toan').insert([
      {
        don_dat_lich_id: booking.id,
        loai_thanh_toan: 'tien_coc_30',
        so_tien: booking.tien_coc,
        hinh_thuc: parsed.hinh_thuc,
        ma_giao_dich: parsed.ma_giao_dich || generateTxnCode('DEP'),
        trang_thai: 'thanh_cong',
      },
    ]);
    if (payErr) throw new AppError(payErr.message, 500, 'DATABASE_ERROR');

    const { data: updated, error: upErr } = await supabase
      .from('don_dat_lich')
      .update({
        trang_thai_don: 'da_coc',
        trang_thai_thanh_toan: 'da_thanh_toan_coc',
        thoi_gian_het_han_giu_cho: null,
      })
      .eq('id', booking.id)
      .select('*')
      .single();

    if (upErr) throw new AppError(upErr.message, 500, 'DATABASE_ERROR');

    return sendSuccess(res, {
      message: 'Admin đã xác nhận tiền cọc 30% thành công',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/admin/bookings/:id/assign-photographer
 */
const assignPhotographer = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');
    const parsed = z.object({ tho_chup_id: z.coerce.number().int().positive() }).parse(req.body);

    const [{ data: booking, error: bErr }, { data: photographer, error: pErr }] = await Promise.all([
      supabase.from('don_dat_lich').select('*').eq('id', bookingId).maybeSingle(),
      supabase
        .from('nguoi_dung')
        .select('id, ho_ten, vai_tro, trang_thai')
        .eq('id', parsed.tho_chup_id)
        .eq('vai_tro', 'tho_chup')
        .maybeSingle(),
    ]);

    if (bErr) throw new AppError(bErr.message, 500, 'DATABASE_ERROR');
    if (pErr) throw new AppError(pErr.message, 500, 'DATABASE_ERROR');
    if (!booking) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');
    if (!photographer || !photographer.trang_thai) {
      throw new AppError('Nhiếp ảnh gia không tồn tại hoặc đang ngừng làm việc', 404, 'PHOTOGRAPHER_NOT_FOUND');
    }

    const { data: conflict, error: cErr } = await supabase
      .from('don_dat_lich')
      .select('id, ma_don')
      .eq('ngay_chup', booking.ngay_chup)
      .eq('khung_gio_id', booking.khung_gio_id)
      .eq('tho_chup_id', parsed.tho_chup_id)
      .neq('id', booking.id)
      .in('trang_thai_don', ACTIVE_BOOKING_STATUSES)
      .maybeSingle();

    if (cErr) throw new AppError(cErr.message, 500, 'DATABASE_ERROR');
    if (conflict) {
      throw new AppError(
        `Nhiếp ảnh gia ${photographer.ho_ten} đã được phân công cho đơn ${conflict.ma_don} ở cùng ca chụp này`,
        409,
        'PHOTOGRAPHER_CONFLICT'
      );
    }

    const { data: updated, error: upErr } = await supabase
      .from('don_dat_lich')
      .update({ tho_chup_id: parsed.tho_chup_id })
      .eq('id', booking.id)
      .select('*')
      .single();

    if (upErr) throw new AppError(upErr.message, 500, 'DATABASE_ERROR');

    return sendSuccess(res, {
      message: `Đã phân công nhiếp ảnh gia ${photographer.ho_ten}`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/admin/bookings/:id/status
 */
const updateBookingStatus = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');
    const parsed = z
      .object({
        trang_thai_don: z.string().trim().min(1),
        ghi_chu_noi_bo: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(req.body);

    const normalizedStatus = normalizeBookingStatus(parsed.trang_thai_don);
    if (!BOOKING_STATUS_ENUM.includes(normalizedStatus)) {
      throw new AppError(`Trạng thái đơn '${parsed.trang_thai_don}' không hợp lệ`, 400, 'INVALID_BOOKING_STATUS');
    }

    const updateData = { trang_thai_don: normalizedStatus };
    if (parsed.ghi_chu_noi_bo !== undefined) {
      updateData.ghi_chu_noi_bo = parsed.ghi_chu_noi_bo;
    }

    const { data: updated, error } = await supabase
      .from('don_dat_lich')
      .update(updateData)
      .eq('id', bookingId)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(error.message, 500, 'DATABASE_ERROR');
    if (!updated) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    return sendSuccess(res, {
      message: 'Cập nhật trạng thái đơn đặt lịch thành công',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/admin/bookings/:id/final-payment
 */
const confirmFinalPayment = async (req, res, next) => {
  try {
    const bookingId = parsePositiveId(req.params.id, 'ID đơn đặt lịch');
    const parsed = z
      .object({
        hinh_thuc: z.enum(['tien_mat', 'chuyen_khoan']).optional().default('tien_mat'),
        ma_giao_dich: z.string().trim().max(100).optional().nullable(),
      })
      .parse(req.body || {});

    const { data: booking, error } = await supabase
      .from('don_dat_lich')
      .select('*')
      .eq('id', bookingId)
      .maybeSingle();

    if (error) throw new AppError(error.message, 500, 'DATABASE_ERROR');
    if (!booking) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    if (booking.trang_thai_thanh_toan === 'da_thanh_toan_du') {
      throw new AppError('Đơn đặt lịch này đã được tất toán đầy đủ trước đó', 400, 'ALREADY_PAID_IN_FULL');
    }
    if (booking.trang_thai_thanh_toan !== 'da_thanh_toan_coc') {
      throw new AppError('Đơn chưa thanh toán cọc 30%, không thể tất toán 70%', 400, 'DEPOSIT_REQUIRED');
    }

    const { error: payErr } = await supabase.from('lich_su_thanh_toan').insert([
      {
        don_dat_lich_id: booking.id,
        loai_thanh_toan: 'tat_toan_70',
        so_tien: booking.tien_con_lai,
        hinh_thuc: parsed.hinh_thuc,
        ma_giao_dich: parsed.ma_giao_dich || generateTxnCode('FIN'),
        trang_thai: 'thanh_cong',
      },
    ]);
    if (payErr) throw new AppError(payErr.message, 500, 'DATABASE_ERROR');

    const { data: updated, error: upErr } = await supabase
      .from('don_dat_lich')
      .update({ trang_thai_thanh_toan: 'da_thanh_toan_du' })
      .eq('id', booking.id)
      .select('*')
      .single();

    if (upErr) throw new AppError(upErr.message, 500, 'DATABASE_ERROR');

    return sendSuccess(res, {
      message: 'Xác nhận tất toán 70% còn lại thành công',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

// ============================================================================
// 2. UPLOAD ẢNH ALBUM (/raw-photos & /final-photos)
// ============================================================================

/**
 * POST /api/admin/albums/:donDatLichId/raw-photos
 */
const uploadRawPhotos = async (req, res, next) => {
  try {
    const donDatLichId = parsePositiveId(req.params.donDatLichId, 'ID đơn đặt lịch');

    const { data: booking, error: bErr } = await supabase
      .from('don_dat_lich')
      .select(`
        id,
        ma_don,
        khach_hang_id,
        goi_dich_vu:goi_dich_vu_id ( id, ten_goi, so_anh_chinh_sua ),
        khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten ),
        concept:concept_id ( id, ten_concept )
      `)
      .eq('id', donDatLichId)
      .maybeSingle();

    if (bErr) throw new AppError(bErr.message, 500, 'DATABASE_ERROR');
    if (!booking) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    const files = Array.isArray(req.files) ? req.files : [];
    const bodyUrls = Array.isArray(req.body?.photo_urls)
      ? req.body.photo_urls.filter((u) => typeof u === 'string' && u.trim())
      : [];

    if (files.length === 0 && bodyUrls.length === 0) {
      throw new AppError('Vui lòng tải lên ít nhất 1 file ảnh hoặc truyền danh sách photo_urls', 400, 'NO_FILES_PROVIDED');
    }

    let { data: album, error: aFindErr } = await supabase
      .from('album')
      .select('*')
      .eq('don_dat_lich_id', booking.id)
      .maybeSingle();

    if (aFindErr) throw new AppError(aFindErr.message, 500, 'DATABASE_ERROR');

    if (!album) {
      const defaultTitle =
        req.body?.tieu_de ||
        `Album ${booking.concept?.ten_concept || booking.ma_don} - ${booking.khach_hang?.ho_ten || 'Khách hàng'}`;

      const { data: createdAlbum, error: aCreateErr } = await supabase
        .from('album')
        .insert([
          {
            don_dat_lich_id: booking.id,
            tieu_de: defaultTitle,
            tong_so_anh_tho: 0,
            so_anh_toi_da_duoc_chon: booking.goi_dich_vu?.so_anh_chinh_sua || 10,
            so_anh_da_chon: 0,
            trang_thai_album: 'cho_khach_duyet',
          },
        ])
        .select('*')
        .single();

      if (aCreateErr) throw new AppError(aCreateErr.message, 500, 'DATABASE_ERROR');
      album = createdAlbum;
    }

    const uploadedPaths = [];
    for (const file of files) {
      const storagePath = await uploadBufferToStorage({
        buffer: file.buffer,
        originalName: file.originalname,
        mimeType: file.mimetype,
        folder: `albums/${booking.ma_don}/raw`,
      });
      uploadedPaths.push(storagePath);
    }

    const allPaths = [...uploadedPaths, ...bodyUrls.map((u) => u.trim())];
    const rowsToInsert = allPaths.map((p) => ({
      album_id: album.id,
      duong_dan_anh_tho: p,
      duoc_chon: false,
    }));

    const { data: insertedPhotos, error: pInsertErr } = await supabase
      .from('anh_album')
      .insert(rowsToInsert)
      .select('*');

    if (pInsertErr) throw new AppError(pInsertErr.message, 500, 'DATABASE_ERROR');

    const { count: totalRawCount } = await supabase
      .from('anh_album')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', album.id);

    const { data: updatedAlbum } = await supabase
      .from('album')
      .update({ tong_so_anh_tho: totalRawCount || allPaths.length })
      .eq('id', album.id)
      .select('*')
      .single();

    await supabase.from('don_dat_lich').update({ trang_thai_don: 'cho_chon_anh' }).eq('id', booking.id);

    const previewUrls = await resolveStorageUrls(allPaths);

    return sendSuccess(res, {
      statusCode: 201,
      message: `Đã tải lên ${allPaths.length} ảnh thô và mở cổng duyệt ảnh cho khách`,
      data: {
        album: updatedAlbum,
        anh_moi: (insertedPhotos || []).map((p, idx) => ({ ...p, url_anh_tho: previewUrls[idx] })),
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/albums/:albumId/final-photos
 */
const uploadFinalPhotos = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.albumId, 'ID album');

    const { data: album, error: aErr } = await supabase
      .from('album')
      .select('*, don_dat_lich:don_dat_lich_id ( id, ma_don )')
      .eq('id', albumId)
      .maybeSingle();

    if (aErr) throw new AppError(aErr.message, 500, 'DATABASE_ERROR');
    if (!album) throw new AppError('Không tìm thấy album', 404, 'ALBUM_NOT_FOUND');

    const { data: selectedPhotos, error: sErr } = await supabase
      .from('anh_album')
      .select('*')
      .eq('album_id', album.id)
      .eq('duoc_chon', true)
      .order('id', { ascending: true });

    if (sErr) throw new AppError(sErr.message, 500, 'DATABASE_ERROR');

    const files = Array.isArray(req.files) ? req.files : [];
    const itemsFromBody = Array.isArray(req.body?.items) ? req.body.items : [];
    const urlsFromBody = Array.isArray(req.body?.photo_urls)
      ? req.body.photo_urls.filter((u) => typeof u === 'string' && u.trim())
      : [];

    if (files.length === 0 && itemsFromBody.length === 0 && urlsFromBody.length === 0) {
      throw new AppError('Vui lòng cung cấp ảnh hoàn thiện để bàn giao', 400, 'NO_FILES_PROVIDED');
    }

    let explicitPhotoIds = [];
    if (req.body?.anh_album_ids) {
      explicitPhotoIds = Array.isArray(req.body.anh_album_ids)
        ? req.body.anh_album_ids.map(Number)
        : JSON.parse(req.body.anh_album_ids).map(Number);
    }

    const updatedRows = [];

    if (files.length > 0) {
      const folder = `albums/${album.don_dat_lich?.ma_don || album.id}/final`;
      for (let i = 0; i < files.length; i += 1) {
        const storagePath = await uploadBufferToStorage({
          buffer: files[i].buffer,
          originalName: files[i].originalname,
          mimeType: files[i].mimetype,
          folder,
        });

        const targetPhotoId = explicitPhotoIds[i] || selectedPhotos?.[i]?.id;
        if (targetPhotoId) {
          const { data: row, error: upErr } = await supabase
            .from('anh_album')
            .update({ duong_dan_anh_hoan_thien: storagePath })
            .eq('id', targetPhotoId)
            .eq('album_id', album.id)
            .select('*')
            .single();
          if (upErr) throw new AppError(upErr.message, 500, 'DATABASE_ERROR');
          updatedRows.push(row);
        } else {
          const { data: row, error: insErr } = await supabase
            .from('anh_album')
            .insert([
              {
                album_id: album.id,
                duong_dan_anh_tho: storagePath,
                duong_dan_anh_hoan_thien: storagePath,
                duoc_chon: true,
              },
            ])
            .select('*')
            .single();
          if (insErr) throw new AppError(insErr.message, 500, 'DATABASE_ERROR');
          updatedRows.push(row);
        }
      }
    }

    for (const item of itemsFromBody) {
      const { data: row, error: upErr } = await supabase
        .from('anh_album')
        .update({ duong_dan_anh_hoan_thien: String(item.url).trim() })
        .eq('id', Number(item.anh_album_id))
        .eq('album_id', album.id)
        .select('*')
        .single();
      if (upErr) throw new AppError(upErr.message, 500, 'DATABASE_ERROR');
      updatedRows.push(row);
    }

    for (let i = 0; i < urlsFromBody.length; i += 1) {
      const url = urlsFromBody[i].trim();
      const targetPhotoId = explicitPhotoIds[i] || selectedPhotos?.[i]?.id;
      if (targetPhotoId) {
        const { data: row, error: upErr } = await supabase
          .from('anh_album')
          .update({ duong_dan_anh_hoan_thien: url })
          .eq('id', targetPhotoId)
          .eq('album_id', album.id)
          .select('*')
          .single();
        if (upErr) throw new AppError(upErr.message, 500, 'DATABASE_ERROR');
        updatedRows.push(row);
      }
    }

    const { data: deliveredAlbum } = await supabase
      .from('album')
      .update({ trang_thai_album: 'da_ban_giao' })
      .eq('id', album.id)
      .select('*')
      .single();

    await supabase.from('don_dat_lich').update({ trang_thai_don: 'hoan_thanh' }).eq('id', album.don_dat_lich_id);

    return sendSuccess(res, {
      message: 'Đã tải lên ảnh hoàn thiện và bàn giao album thành công',
      data: {
        album: deliveredAlbum,
        anh_da_cap_nhat: updatedRows.length,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ============================================================================
// 3. QUẢN TRỊ LỊCH SỬ THANH TOÁN, THỐNG KÊ & NHẬT KÝ HOẠT ĐỘNG
// ============================================================================

/**
 * GET /api/admin/payments
 */
const listAdminPayments = async (req, res, next) => {
  try {
    let query = supabase
      .from('lich_su_thanh_toan')
      .select(`
        *,
        don_dat_lich:don_dat_lich_id (
          id,
          ma_don,
          ngay_chup,
          khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten, so_dien_thoai )
        )
      `)
      .order('ngay_thanh_toan', { ascending: false });

    if (req.query.don_dat_lich_id) {
      query = query.eq('don_dat_lich_id', Number(req.query.don_dat_lich_id));
    }
    if (req.query.loai_thanh_toan) {
      query = query.eq('loai_thanh_toan', String(req.query.loai_thanh_toan).trim());
    }

    const { data, error } = await query;
    if (error) throw new AppError(error.message, 500, 'DATABASE_ERROR');

    return sendSuccess(res, { message: 'Lấy lịch sử giao dịch thành công', data: data || [] });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/payments/:id
 */
const deleteAdminPayment = async (req, res, next) => {
  try {
    const id = parsePositiveId(req.params.id, 'ID giao dịch');
    const { data: deleted, error } = await supabase
      .from('lich_su_thanh_toan')
      .delete()
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(error.message, 400, 'DELETE_PAYMENT_FAILED');
    if (!deleted) throw new AppError('Không tìm thấy giao dịch', 404, 'PAYMENT_NOT_FOUND');

    return sendSuccess(res, { message: 'Đã xóa bản ghi giao dịch', data: deleted });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/activity-logs
 * Tổng hợp nhật ký hoạt động thời gian thực từ Đơn đặt lịch, Thanh toán và Album.
 */
const getActivityLogs = async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(5, Number(req.query.limit) || 30));

    const [{ data: bookings }, { data: payments }, { data: albums }] = await Promise.all([
      supabase
        .from('don_dat_lich')
        .select('id, ma_don, trang_thai_don, ngay_tao, khach_hang:nguoi_dung!khach_hang_id(ho_ten)')
        .order('ngay_tao', { ascending: false })
        .limit(20),
      supabase
        .from('lich_su_thanh_toan')
        .select('id, loai_thanh_toan, so_tien, hinh_thuc, ngay_thanh_toan, don_dat_lich:don_dat_lich_id(ma_don)')
        .order('ngay_thanh_toan', { ascending: false })
        .limit(20),
      supabase
        .from('album')
        .select('id, tieu_de, trang_thai_album, so_anh_da_chon, thoi_gian_chot_anh, ngay_tao')
        .order('ngay_tao', { ascending: false })
        .limit(20),
    ]);

    const events = [];

    for (const p of payments || []) {
      events.push({
        id: `pay-${p.id}`,
        loai: 'thanh_toan',
        mau_sac: 'green',
        tieu_de:
          p.loai_thanh_toan === 'tien_coc_30'
            ? 'Ghi nhận thanh toán tiền cọc 30%'
            : 'Ghi nhận tất toán 70% còn lại',
        mo_ta: `Đơn #${p.don_dat_lich?.ma_don || ''} • ${Number(p.so_tien).toLocaleString('vi-VN')} VNĐ (${p.hinh_thuc})`,
        thoi_gian: p.ngay_thanh_toan,
      });
    }

    for (const b of bookings || []) {
      events.push({
        id: `book-${b.id}`,
        loai: 'dat_lich',
        mau_sac: 'blue',
        tieu_de: `Đơn đặt lịch #${b.ma_don}`,
        mo_ta: `Khách hàng ${b.khach_hang?.ho_ten || 'Khách'} • Trạng thái: ${b.trang_thai_don}`,
        thoi_gian: b.ngay_tao,
      });
    }

    for (const a of albums || []) {
      events.push({
        id: `album-${a.id}`,
        loai: 'duyet_anh',
        mau_sac: 'gold',
        tieu_de: a.thoi_gian_chot_anh ? 'Khách hàng đã chốt danh sách ảnh' : 'Khởi tạo album duyệt ảnh',
        mo_ta: `${a.tieu_de} • Đã chọn ${a.so_anh_da_chon || 0} ảnh (${a.trang_thai_album})`,
        thoi_gian: a.thoi_gian_chot_anh || a.ngay_tao,
      });
    }

    events.sort((a, b) => new Date(b.thoi_gian || 0).getTime() - new Date(a.thoi_gian || 0).getTime());

    return sendSuccess(res, {
      message: 'Lấy nhật ký hoạt động thành công',
      data: events.slice(0, limit),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
  try {
    const [
      { data: payments, error: pErr },
      { data: bookings, error: bErr },
      { data: rooms, error: rErr },
      { data: packages, error: pkgErr },
    ] = await Promise.all([
      supabase.from('lich_su_thanh_toan').select('loai_thanh_toan, so_tien, trang_thai, ngay_thanh_toan'),
      supabase.from('don_dat_lich').select('trang_thai_don, phong_chup_id, goi_dich_vu_id, tien_coc'),
      supabase.from('phong_chup').select('id, ten_phong'),
      supabase.from('goi_dich_vu').select('id, ten_goi, ma_goi'),
    ]);

    if (pErr) throw new AppError(pErr.message, 500, 'DATABASE_ERROR');
    if (bErr) throw new AppError(bErr.message, 500, 'DATABASE_ERROR');
    if (rErr) throw new AppError(rErr.message, 500, 'DATABASE_ERROR');
    if (pkgErr) throw new AppError(pkgErr.message, 500, 'DATABASE_ERROR');

    const validPayments = (payments || []).filter((p) => p.trang_thai === 'thanh_cong');
    const tongDoanhThu = validPayments.reduce((sum, p) => sum + Number(p.so_tien || 0), 0);
    const doanhThuCoc = validPayments
      .filter((p) => p.loai_thanh_toan === 'tien_coc_30')
      .reduce((sum, p) => sum + Number(p.so_tien || 0), 0);

    // 6-month revenue breakdown
    const revenueByMonth = {};
    for (const p of validPayments) {
      if (p.ngay_thanh_toan) {
        const ym = p.ngay_thanh_toan.slice(0, 7);
        revenueByMonth[ym] = (revenueByMonth[ym] || 0) + Number(p.so_tien || 0);
      }
    }

    const thongKeTrangThai = {};
    const countByRoom = {};
    const countByPackage = {};
    for (const b of bookings || []) {
      thongKeTrangThai[b.trang_thai_don] = (thongKeTrangThai[b.trang_thai_don] || 0) + 1;
      if (b.phong_chup_id) countByRoom[b.phong_chup_id] = (countByRoom[b.phong_chup_id] || 0) + 1;
      if (b.goi_dich_vu_id) countByPackage[b.goi_dich_vu_id] = (countByPackage[b.goi_dich_vu_id] || 0) + 1;
    }

    const thongKePhong = (rooms || []).map((r) => ({
      phong_chup_id: r.id,
      ten_phong: r.ten_phong,
      so_luot_dat: countByRoom[r.id] || 0,
    }));

    const thongKeGoi = (packages || []).map((pkg) => ({
      goi_dich_vu_id: pkg.id,
      ten_goi: pkg.ten_goi,
      ma_goi: pkg.ma_goi,
      so_luot_dat: countByPackage[pkg.id] || 0,
    }));

    return sendSuccess(res, {
      message: 'Lấy thống kê vận hành studio thành công',
      data: {
        tong_doanh_thu: tongDoanhThu,
        doanh_thu_coc: doanhThuCoc,
        tong_so_don: (bookings || []).length,
        doanh_thu_theo_thang: revenueByMonth,
        thong_ke_trang_thai: thongKeTrangThai,
        thong_ke_phong: thongKePhong,
        thong_ke_goi_dich_vu: thongKeGoi,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAdminBookings,
  getAdminBookingDetail,
  createAdminBooking,
  updateAdminBooking,
  deleteAdminBooking,
  getPhotographers,
  confirmDeposit,
  assignPhotographer,
  updateBookingStatus,
  confirmFinalPayment,
  uploadRawPhotos,
  uploadFinalPhotos,
  listAdminPayments,
  deleteAdminPayment,
  getActivityLogs,
  getStats,
};
