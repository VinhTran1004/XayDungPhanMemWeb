const crypto = require('crypto');
const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');
const { ACTIVE_BOOKING_STATUSES, releaseExpiredHolds } = require('../services/slotService');
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

// Catalog resource definitions for unified CRUD
const CATALOG_RESOURCES = {
  categories: {
    table: 'danh_muc_dich_vu',
    createSchema: z.object({
      ten_danh_muc: z.string().trim().min(2).max(150),
      duong_dan_danh_muc: z.string().trim().min(2).max(150),
      mo_ta: z.string().trim().optional().nullable(),
      hinh_dai_dien: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional().default(true),
    }),
  },
  concepts: {
    table: 'concept',
    createSchema: z.object({
      danh_muc_id: z.coerce.number().int().positive(),
      phong_chup_id: z.coerce.number().int().positive(),
      ten_concept: z.string().trim().min(2).max(150),
      duong_dan_concept: z.string().trim().min(2).max(150),
      mo_ta: z.string().trim().optional().nullable(),
      hinh_dai_dien: z.string().trim().min(1),
      danh_sach_hinh_mau: z.array(z.string().trim()).optional().default([]),
      goi_y_trang_phuc: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional().default(true),
    }),
  },
  packages: {
    table: 'goi_dich_vu',
    createSchema: z.object({
      ten_goi: z.string().trim().min(2).max(150),
      ma_goi: z.string().trim().min(2).max(50),
      mo_ta: z.string().trim().optional().nullable(),
      gia_co_ban: z.coerce.number().nonnegative(),
      thoi_luong_phut: z.coerce.number().int().positive(),
      so_anh_chinh_sua: z.coerce.number().int().positive(),
      so_trang_phuc_toi_da: z.coerce.number().int().positive().optional().default(1),
      trang_thai: z.boolean().optional().default(true),
    }),
  },
  addons: {
    table: 'dich_vu_cong_them',
    createSchema: z.object({
      ten_dich_vu: z.string().trim().min(2).max(150),
      gia: z.coerce.number().nonnegative(),
      don_vi_tinh: z.string().trim().max(30).optional().default('lan'),
      mo_ta: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional().default(true),
    }),
  },
  rooms: {
    table: 'phong_chup',
    createSchema: z.object({
      ten_phong: z.string().trim().min(2).max(150),
      phong_cach: z.string().trim().min(2).max(200),
      mo_ta: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional().default(true),
    }),
  },
};

const getCatalogResourceConfig = (resourceKey) => {
  const cfg = CATALOG_RESOURCES[resourceKey];
  if (!cfg) {
    throw new AppError(`Loại danh mục '${resourceKey}' không hợp lệ`, 404, 'INVALID_CATALOG_RESOURCE');
  }
  return cfg;
};

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
      .select(
        `
        *,
        concept:concept_id ( id, ten_concept ),
        phong_chup:phong_chup_id ( id, ten_phong ),
        goi_dich_vu:goi_dich_vu_id ( id, ten_goi, ma_goi, so_anh_chinh_sua ),
        khung_gio_chup:khung_gio_id ( id, ca_chup, gio_bat_dau, gio_ket_thuc ),
        khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten, email, so_dien_thoai ),
        tho_chup:nguoi_dung!tho_chup_id ( id, ho_ten, email, so_dien_thoai )
      `,
        { count: 'exact' }
      )
      .order('ngay_chup', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (req.query.ngay_chup) query = query.eq('ngay_chup', String(req.query.ngay_chup).trim());
    if (req.query.phong_chup_id) query = query.eq('phong_chup_id', Number(req.query.phong_chup_id));
    if (req.query.tho_chup_id) query = query.eq('tho_chup_id', Number(req.query.tho_chup_id));
    if (req.query.trang_thai_don) query = query.eq('trang_thai_don', String(req.query.trang_thai_don).trim());
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
      data: data || [],
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

    // Ensure photographer is not already assigned to another active booking in the same date + slot
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
        trang_thai_don: z.enum(BOOKING_STATUS_ENUM),
        ghi_chu_noi_bo: z.string().trim().max(1000).optional().nullable(),
      })
      .parse(req.body);

    const updateData = { trang_thai_don: parsed.trang_thai_don };
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

/**
 * POST /api/admin/albums/:donDatLichId/raw-photos
 * Supports multipart file upload (`photos`) OR JSON `{ tieu_de?, photo_urls: string[] }`.
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

    // Create album if not exists
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
 * Supports multipart file upload (`photos` + optional `anh_album_ids`) OR JSON `{ items: [{ anh_album_id, url }] }` / `photo_urls`.
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

    // 1) Handle uploaded files
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

    // 2) Handle explicit JSON items [{ anh_album_id, url }]
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

    // 3) Handle JSON photo_urls mapped sequentially to selected photos
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

/**
 * GET /api/admin/stats
 */
const getStats = async (req, res, next) => {
  try {
    const [{ data: payments, error: pErr }, { data: bookings, error: bErr }, { data: rooms, error: rErr }] =
      await Promise.all([
        supabase.from('lich_su_thanh_toan').select('loai_thanh_toan, so_tien, trang_thai'),
        supabase.from('don_dat_lich').select('trang_thai_don, phong_chup_id'),
        supabase.from('phong_chup').select('id, ten_phong'),
      ]);

    if (pErr) throw new AppError(pErr.message, 500, 'DATABASE_ERROR');
    if (bErr) throw new AppError(bErr.message, 500, 'DATABASE_ERROR');
    if (rErr) throw new AppError(rErr.message, 500, 'DATABASE_ERROR');

    const tongDoanhThu = (payments || [])
      .filter((p) => p.trang_thai === 'thanh_cong')
      .reduce((sum, p) => sum + Number(p.so_tien || 0), 0);

    const thongKeTrangThai = {};
    const countByRoom = {};
    for (const b of bookings || []) {
      thongKeTrangThai[b.trang_thai_don] = (thongKeTrangThai[b.trang_thai_don] || 0) + 1;
      if (b.phong_chup_id) {
        countByRoom[b.phong_chup_id] = (countByRoom[b.phong_chup_id] || 0) + 1;
      }
    }

    const thongKePhong = (rooms || []).map((r) => ({
      phong_chup_id: r.id,
      ten_phong: r.ten_phong,
      so_luot_dat: countByRoom[r.id] || 0,
    }));

    return sendSuccess(res, {
      message: 'Lấy thống kê vận hành studio thành công',
      data: {
        tong_doanh_thu: tongDoanhThu,
        tong_so_don: (bookings || []).length,
        thong_ke_trang_thai: thongKeTrangThai,
        thong_ke_phong: thongKePhong,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Unified Admin Catalog CRUD handlers
 */
const createCatalogItem = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const payload = cfg.createSchema.parse(req.body);
    const { data, error } = await supabase.from(cfg.table).insert([payload]).select('*').single();
    if (error) throw new AppError(`Lỗi tạo bản ghi ${cfg.table}: ${error.message}`, 400, 'CREATE_FAILED');
    return sendSuccess(res, { statusCode: 201, message: 'Tạo mới thành công', data });
  } catch (err) {
    return next(err);
  }
};

const updateCatalogItem = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const id = parsePositiveId(req.params.id);
    const payload = cfg.createSchema.partial().parse(req.body);
    if (Object.keys(payload).length === 0) {
      throw new AppError('Không có dữ liệu cần cập nhật', 400, 'EMPTY_UPDATE');
    }
    const { data, error } = await supabase.from(cfg.table).update(payload).eq('id', id).select('*').maybeSingle();
    if (error) throw new AppError(`Lỗi cập nhật ${cfg.table}: ${error.message}`, 400, 'UPDATE_FAILED');
    if (!data) throw new AppError('Không tìm thấy bản ghi cần cập nhật', 404, 'NOT_FOUND');
    return sendSuccess(res, { message: 'Cập nhật thành công', data });
  } catch (err) {
    return next(err);
  }
};

const deleteCatalogItem = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const id = parsePositiveId(req.params.id);
    // Soft disable (`trang_thai = false`) to preserve historical booking foreign keys
    const { data, error } = await supabase
      .from(cfg.table)
      .update({ trang_thai: false })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) throw new AppError(`Lỗi vô hiệu hóa ${cfg.table}: ${error.message}`, 400, 'DELETE_FAILED');
    if (!data) throw new AppError('Không tìm thấy bản ghi', 404, 'NOT_FOUND');
    return sendSuccess(res, { message: 'Đã ẩn/vô hiệu hóa mục danh mục thành công', data });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getAdminBookings,
  getPhotographers,
  confirmDeposit,
  assignPhotographer,
  updateBookingStatus,
  confirmFinalPayment,
  uploadRawPhotos,
  uploadFinalPhotos,
  getStats,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
};
