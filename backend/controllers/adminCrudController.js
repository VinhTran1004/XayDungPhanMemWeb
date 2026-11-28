const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');
const { USER_PUBLIC_FIELDS } = require('../middlewares/authMiddleware');
const { deleteFromStorage, resolveStorageUrls } = require('../services/storageService');

const USER_ROLES = ['khach_hang', 'tho_chup', 'quan_tri_vien'];
const ALBUM_STATUSES = ['cho_khach_duyet', 'da_chot_chon_anh', 'da_ban_giao'];

const parsePositiveId = (rawId, label = 'ID') => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${label} không hợp lệ`, 400, 'INVALID_ID');
  }
  return id;
};

/**
 * Convert Vietnamese text into a clean URL-safe slug when slug/code is omitted by Admin UI.
 */
const slugifyVietnamese = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const generateVoucherCode = () => {
  const now = new Date();
  const ym = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `VCH-${ym}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
};

// ============================================================================
// 1. QUẢN TRỊ CRUD DANH MỤC SẢN PHẨM (CATALOG RESOURCES)
// Hỗ trợ: categories | concepts | packages | addons | rooms | time-slots
// ============================================================================

const CATALOG_RESOURCES = {
  categories: {
    table: 'danh_muc_dich_vu',
    select: '*',
    orderBy: 'id',
    createSchema: z
      .object({
        ten_danh_muc: z.string({ required_error: 'Vui lòng nhập tên danh mục' }).trim().min(2).max(150),
        duong_dan_danh_muc: z.string().trim().min(2).max(150).optional(),
        mo_ta: z.string().trim().optional().nullable(),
        hinh_dai_dien: z.string().trim().optional().nullable(),
        trang_thai: z.boolean().optional().default(true),
      })
      .transform((val) => ({
        ...val,
        duong_dan_danh_muc: val.duong_dan_danh_muc || slugifyVietnamese(val.ten_danh_muc),
      })),
    updateSchema: z.object({
      ten_danh_muc: z.string().trim().min(2).max(150).optional(),
      duong_dan_danh_muc: z.string().trim().min(2).max(150).optional(),
      mo_ta: z.string().trim().optional().nullable(),
      hinh_dai_dien: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional(),
    }),
  },
  concepts: {
    table: 'concept',
    select: `
      *,
      danh_muc_dich_vu ( id, ten_danh_muc, duong_dan_danh_muc ),
      phong_chup ( id, ten_phong, phong_cach )
    `,
    orderBy: 'id',
    createSchema: z
      .object({
        danh_muc_id: z.coerce.number().int().positive('Vui lòng chọn danh mục'),
        phong_chup_id: z.coerce.number().int().positive('Vui lòng chọn phòng chụp'),
        ten_concept: z.string({ required_error: 'Vui lòng nhập tên concept' }).trim().min(2).max(150),
        duong_dan_concept: z.string().trim().min(2).max(150).optional(),
        mo_ta: z.string().trim().optional().nullable(),
        hinh_dai_dien: z.string({ required_error: 'Vui lòng nhập ảnh đại diện' }).trim().min(1),
        danh_sach_hinh_mau: z.array(z.string().trim()).optional().default([]),
        goi_y_trang_phuc: z.string().trim().optional().nullable(),
        trang_thai: z.boolean().optional().default(true),
      })
      .transform((val) => ({
        ...val,
        duong_dan_concept: val.duong_dan_concept || slugifyVietnamese(val.ten_concept),
      })),
    updateSchema: z.object({
      danh_muc_id: z.coerce.number().int().positive().optional(),
      phong_chup_id: z.coerce.number().int().positive().optional(),
      ten_concept: z.string().trim().min(2).max(150).optional(),
      duong_dan_concept: z.string().trim().min(2).max(150).optional(),
      mo_ta: z.string().trim().optional().nullable(),
      hinh_dai_dien: z.string().trim().min(1).optional(),
      danh_sach_hinh_mau: z.array(z.string().trim()).optional(),
      goi_y_trang_phuc: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional(),
    }),
  },
  packages: {
    table: 'goi_dich_vu',
    select: '*',
    orderBy: 'gia_co_ban',
    createSchema: z
      .object({
        ten_goi: z.string({ required_error: 'Vui lòng nhập tên gói' }).trim().min(2).max(150),
        ma_goi: z.string().trim().min(2).max(50).optional(),
        mo_ta: z.string().trim().optional().nullable(),
        gia_co_ban: z.coerce.number().nonnegative('Giá cơ bản không hợp lệ'),
        thoi_luong_phut: z.coerce.number().int().positive('Thời lượng phải lớn hơn 0'),
        so_anh_chinh_sua: z.coerce.number().int().positive('Số ảnh chỉnh sửa phải lớn hơn 0'),
        so_trang_phuc_toi_da: z.coerce.number().int().positive().optional().default(1),
        trang_thai: z.boolean().optional().default(true),
      })
      .transform((val) => ({
        ...val,
        ma_goi: val.ma_goi || slugifyVietnamese(val.ten_goi),
      })),
    updateSchema: z.object({
      ten_goi: z.string().trim().min(2).max(150).optional(),
      ma_goi: z.string().trim().min(2).max(50).optional(),
      mo_ta: z.string().trim().optional().nullable(),
      gia_co_ban: z.coerce.number().nonnegative().optional(),
      thoi_luong_phut: z.coerce.number().int().positive().optional(),
      so_anh_chinh_sua: z.coerce.number().int().positive().optional(),
      so_trang_phuc_toi_da: z.coerce.number().int().positive().optional(),
      trang_thai: z.boolean().optional(),
    }),
  },
  addons: {
    table: 'dich_vu_cong_them',
    select: '*',
    orderBy: 'id',
    createSchema: z.object({
      ten_dich_vu: z.string({ required_error: 'Vui lòng nhập tên dịch vụ' }).trim().min(2).max(150),
      gia: z.coerce.number().nonnegative('Giá dịch vụ không hợp lệ'),
      don_vi_tinh: z.string().trim().max(30).optional().default('lan'),
      mo_ta: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional().default(true),
    }),
    updateSchema: z.object({
      ten_dich_vu: z.string().trim().min(2).max(150).optional(),
      gia: z.coerce.number().nonnegative().optional(),
      don_vi_tinh: z.string().trim().max(30).optional(),
      mo_ta: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional(),
    }),
  },
  rooms: {
    table: 'phong_chup',
    select: '*',
    orderBy: 'id',
    createSchema: z.object({
      ten_phong: z.string({ required_error: 'Vui lòng nhập tên phòng' }).trim().min(2).max(150),
      phong_cach: z.string({ required_error: 'Vui lòng nhập phong cách phòng' }).trim().min(2).max(200),
      mo_ta: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional().default(true),
    }),
    updateSchema: z.object({
      ten_phong: z.string().trim().min(2).max(150).optional(),
      phong_cach: z.string().trim().min(2).max(200).optional(),
      mo_ta: z.string().trim().optional().nullable(),
      trang_thai: z.boolean().optional(),
    }),
  },
  'time-slots': {
    table: 'khung_gio_chup',
    select: '*',
    orderBy: 'gio_bat_dau',
    createSchema: z.object({
      ca_chup: z.string({ required_error: 'Vui lòng nhập tên ca chụp' }).trim().min(2).max(100),
      gio_bat_dau: z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Giờ bắt đầu phải có dạng HH:MM hoặc HH:MM:SS'),
      gio_ket_thuc: z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Giờ kết thúc phải có dạng HH:MM hoặc HH:MM:SS'),
      trang_thai: z.boolean().optional().default(true),
    }),
    updateSchema: z.object({
      ca_chup: z.string().trim().min(2).max(100).optional(),
      gio_bat_dau: z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
      gio_ket_thuc: z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
      trang_thai: z.boolean().optional(),
    }),
  },
};

const getCatalogResourceConfig = (resourceKey) => {
  const cfg = CATALOG_RESOURCES[resourceKey];
  if (!cfg) {
    throw new AppError(
      `Loại danh mục '${resourceKey}' không hợp lệ (hỗ trợ: ${Object.keys(CATALOG_RESOURCES).join(', ')})`,
      404,
      'INVALID_CATALOG_RESOURCE'
    );
  }
  return cfg;
};

/**
 * GET /api/admin/catalog/:resource?trang_thai=
 * Lấy toàn bộ bản ghi danh mục cho Admin (bao gồm cả mục đã ẩn `trang_thai = false`).
 */
const listCatalogItems = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    let query = supabase.from(cfg.table).select(cfg.select).order(cfg.orderBy, { ascending: true });

    if (req.query.trang_thai !== undefined) {
      query = query.eq('trang_thai', String(req.query.trang_thai) === 'true');
    }

    const { data, error } = await query;
    if (error) throw new AppError(`Lỗi lấy danh sách ${cfg.table}: ${error.message}`, 500, 'DATABASE_ERROR');

    return sendSuccess(res, {
      message: `Lấy danh sách ${req.params.resource} thành công`,
      data: data || [],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/catalog/:resource/:id
 */
const getCatalogItemDetail = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const id = parsePositiveId(req.params.id);

    const { data, error } = await supabase.from(cfg.table).select(cfg.select).eq('id', id).maybeSingle();
    if (error) throw new AppError(`Lỗi truy vấn ${cfg.table}: ${error.message}`, 500, 'DATABASE_ERROR');
    if (!data) throw new AppError('Không tìm thấy bản ghi', 404, 'NOT_FOUND');

    return sendSuccess(res, { message: 'Lấy chi tiết thành công', data });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/catalog/:resource
 */
const createCatalogItem = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const payload = cfg.createSchema.parse(req.body);

    const { data, error } = await supabase.from(cfg.table).insert([payload]).select(cfg.select).single();
    if (error) throw new AppError(`Lỗi tạo bản ghi ${cfg.table}: ${error.message}`, 400, 'CREATE_FAILED');

    return sendSuccess(res, { statusCode: 201, message: 'Tạo mới thành công', data });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH / PUT /api/admin/catalog/:resource/:id
 */
const updateCatalogItem = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const id = parsePositiveId(req.params.id);
    const payload = cfg.updateSchema.parse(req.body);

    if (Object.keys(payload).length === 0) {
      throw new AppError('Không có dữ liệu cần cập nhật', 400, 'EMPTY_UPDATE');
    }

    const { data, error } = await supabase
      .from(cfg.table)
      .update(payload)
      .eq('id', id)
      .select(cfg.select)
      .maybeSingle();

    if (error) throw new AppError(`Lỗi cập nhật ${cfg.table}: ${error.message}`, 400, 'UPDATE_FAILED');
    if (!data) throw new AppError('Không tìm thấy bản ghi cần cập nhật', 404, 'NOT_FOUND');

    return sendSuccess(res, { message: 'Cập nhật thành công', data });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/catalog/:resource/:id?hard=true
 * Mặc định ẩn mềm (`trang_thai = false`) để bảo toàn khóa ngoại lịch sử đặt lịch.
 * Nếu truyền `?hard=true` sẽ thử xóa vĩnh viễn (nếu chưa có đơn đặt lịch tham chiếu).
 */
const deleteCatalogItem = async (req, res, next) => {
  try {
    const cfg = getCatalogResourceConfig(req.params.resource);
    const id = parsePositiveId(req.params.id);
    const isHardDelete = String(req.query.hard || '').toLowerCase() === 'true';

    if (isHardDelete) {
      const { data: deleted, error: delErr } = await supabase
        .from(cfg.table)
        .delete()
        .eq('id', id)
        .select('*')
        .maybeSingle();

      if (delErr) {
        throw new AppError(
          `Không thể xóa vĩnh viễn do bản ghi đang được sử dụng trong đơn đặt lịch (${delErr.message}). Hãy dùng xóa mềm (ẩn).`,
          409,
          'FOREIGN_KEY_CONFLICT'
        );
      }
      if (!deleted) throw new AppError('Không tìm thấy bản ghi', 404, 'NOT_FOUND');
      return sendSuccess(res, { message: 'Đã xóa vĩnh viễn bản ghi thành công', data: deleted });
    }

    const { data, error } = await supabase
      .from(cfg.table)
      .update({ trang_thai: false })
      .eq('id', id)
      .select(cfg.select)
      .maybeSingle();

    if (error) throw new AppError(`Lỗi vô hiệu hóa ${cfg.table}: ${error.message}`, 400, 'DELETE_FAILED');
    if (!data) throw new AppError('Không tìm thấy bản ghi', 404, 'NOT_FOUND');

    return sendSuccess(res, { message: 'Đã ẩn/vô hiệu hóa mục danh mục thành công', data });
  } catch (err) {
    return next(err);
  }
};

// ============================================================================
// 2. QUẢN TRỊ CRUD NGƯỜI DÙNG & NHIẾP ẢNH GIA (/api/admin/users & /photographers)
// ============================================================================

const createUserSchema = z.object({
  ho_ten: z.string({ required_error: 'Vui lòng nhập họ tên' }).trim().min(2).max(120),
  email: z.string({ required_error: 'Vui lòng nhập email' }).trim().email('Email không hợp lệ'),
  so_dien_thoai: z
    .string({ required_error: 'Vui lòng nhập số điện thoại' })
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ'),
  mat_khau: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(100).optional().default('123456'),
  vai_tro: z.enum(USER_ROLES).optional().default('khach_hang'),
  anh_dai_dien: z.string().trim().optional().nullable(),
  trang_thai: z.boolean().optional().default(true),
});

const updateUserSchema = z.object({
  ho_ten: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email('Email không hợp lệ').optional(),
  so_dien_thoai: z.string().trim().regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ').optional(),
  mat_khau: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự').max(100).optional(),
  vai_tro: z.enum(USER_ROLES).optional(),
  anh_dai_dien: z.string().trim().optional().nullable(),
  trang_thai: z.boolean().optional(),
});

/**
 * GET /api/admin/users?vai_tro=&trang_thai=&q=&page=&limit=
 */
const listUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('nguoi_dung')
      .select(USER_PUBLIC_FIELDS, { count: 'exact' })
      .order('id', { ascending: true })
      .range(from, to);

    if (req.query.vai_tro) {
      query = query.eq('vai_tro', String(req.query.vai_tro).trim());
    }
    if (req.query.trang_thai !== undefined) {
      query = query.eq('trang_thai', String(req.query.trang_thai) === 'true');
    }
    if (req.query.q) {
      const q = String(req.query.q).trim().replace(/[%_,()]/g, ' ').trim();
      if (q) {
        query = query.or(`ho_ten.ilike.%${q}%,email.ilike.%${q}%,so_dien_thoai.ilike.%${q}%`);
      }
    }

    const { data, error, count } = await query;
    if (error) throw new AppError(`Lỗi lấy danh sách người dùng: ${error.message}`, 500, 'DATABASE_ERROR');

    return sendSuccess(res, {
      message: 'Lấy danh sách người dùng thành công',
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
 * GET /api/admin/users/:id
 */
const getUserDetail = async (req, res, next) => {
  try {
    const userId = parsePositiveId(req.params.id, 'ID người dùng');

    const [{ data: user, error: uErr }, { count: customerBookings }, { count: photographerJobs }] =
      await Promise.all([
        supabase.from('nguoi_dung').select(USER_PUBLIC_FIELDS).eq('id', userId).maybeSingle(),
        supabase.from('don_dat_lich').select('id', { count: 'exact', head: true }).eq('khach_hang_id', userId),
        supabase.from('don_dat_lich').select('id', { count: 'exact', head: true }).eq('tho_chup_id', userId),
      ]);

    if (uErr) throw new AppError(uErr.message, 500, 'DATABASE_ERROR');
    if (!user) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');

    return sendSuccess(res, {
      message: 'Lấy thông tin chi tiết người dùng thành công',
      data: {
        ...user,
        so_don_da_dat: customerBookings || 0,
        so_ca_da_nhan: photographerJobs || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/users (hoặc POST /api/admin/photographers với defaultRole = 'tho_chup')
 */
const createUser = (defaultRole = null) => async (req, res, next) => {
  try {
    const rawBody = defaultRole ? { ...req.body, vai_tro: defaultRole } : req.body;
    const parsed = createUserSchema.parse(rawBody);
    const email = parsed.email.toLowerCase();

    const { data: existing } = await supabase.from('nguoi_dung').select('id').eq('email', email).maybeSingle();
    if (existing) {
      throw new AppError('Email này đã tồn tại trong hệ thống', 409, 'EMAIL_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(parsed.mat_khau, 10);

    const { data: created, error } = await supabase
      .from('nguoi_dung')
      .insert([
        {
          ho_ten: parsed.ho_ten,
          email,
          so_dien_thoai: parsed.so_dien_thoai,
          mat_khau: hashedPassword,
          vai_tro: parsed.vai_tro,
          anh_dai_dien: parsed.anh_dai_dien || null,
          trang_thai: parsed.trang_thai,
        },
      ])
      .select(USER_PUBLIC_FIELDS)
      .single();

    if (error) throw new AppError(`Lỗi tạo tài khoản: ${error.message}`, 400, 'CREATE_USER_FAILED');

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Tạo tài khoản người dùng thành công',
      data: created,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH / PUT /api/admin/users/:id (hoặc /api/admin/photographers/:id)
 */
const updateUser = async (req, res, next) => {
  try {
    const userId = parsePositiveId(req.params.id, 'ID người dùng');
    const parsed = updateUserSchema.parse(req.body);

    if (Object.keys(parsed).length === 0) {
      throw new AppError('Không có dữ liệu cần cập nhật', 400, 'EMPTY_UPDATE');
    }

    if (userId === req.user.id && parsed.trang_thai === false) {
      throw new AppError('Bạn không thể tự khóa tài khoản Quản trị viên của chính mình', 400, 'SELF_LOCK_FORBIDDEN');
    }
    if (userId === req.user.id && parsed.vai_tro && parsed.vai_tro !== 'quan_tri_vien') {
      throw new AppError('Bạn không thể tự hạ quyền Quản trị viên của chính mình', 400, 'SELF_DEMOTE_FORBIDDEN');
    }

    const updatePayload = { ...parsed };
    if (updatePayload.email) {
      updatePayload.email = updatePayload.email.toLowerCase();
      const { data: emailConflict } = await supabase
        .from('nguoi_dung')
        .select('id')
        .eq('email', updatePayload.email)
        .neq('id', userId)
        .maybeSingle();
      if (emailConflict) {
        throw new AppError('Email này đã được sử dụng bởi tài khoản khác', 409, 'EMAIL_EXISTS');
      }
    }

    if (updatePayload.mat_khau) {
      updatePayload.mat_khau = await bcrypt.hash(updatePayload.mat_khau, 10);
    }

    const { data: updated, error } = await supabase
      .from('nguoi_dung')
      .update(updatePayload)
      .eq('id', userId)
      .select(USER_PUBLIC_FIELDS)
      .maybeSingle();

    if (error) throw new AppError(`Lỗi cập nhật người dùng: ${error.message}`, 400, 'UPDATE_USER_FAILED');
    if (!updated) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');

    return sendSuccess(res, {
      message: 'Cập nhật thông tin tài khoản thành công',
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/users/:id?hard=true
 */
const deleteUser = async (req, res, next) => {
  try {
    const userId = parsePositiveId(req.params.id, 'ID người dùng');
    if (userId === req.user.id) {
      throw new AppError('Bạn không thể xóa/khóa tài khoản đang đăng nhập của chính mình', 400, 'SELF_DELETE_FORBIDDEN');
    }

    const isHardDelete = String(req.query.hard || '').toLowerCase() === 'true';
    if (isHardDelete) {
      const { data: deleted, error: delErr } = await supabase
        .from('nguoi_dung')
        .delete()
        .eq('id', userId)
        .select(USER_PUBLIC_FIELDS)
        .maybeSingle();

      if (delErr) {
        throw new AppError(
          `Không thể xóa vĩnh viễn do người dùng đã có lịch sử đơn hàng (${delErr.message}). Hãy khóa tài khoản thay vì xóa hẳn.`,
          409,
          'FOREIGN_KEY_CONFLICT'
        );
      }
      if (!deleted) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');
      return sendSuccess(res, { message: 'Đã xóa vĩnh viễn tài khoản thành công', data: deleted });
    }

    const { data: disabled, error } = await supabase
      .from('nguoi_dung')
      .update({ trang_thai: false })
      .eq('id', userId)
      .select(USER_PUBLIC_FIELDS)
      .maybeSingle();

    if (error) throw new AppError(`Lỗi khóa tài khoản: ${error.message}`, 400, 'DISABLE_USER_FAILED');
    if (!disabled) throw new AppError('Không tìm thấy người dùng', 404, 'USER_NOT_FOUND');

    return sendSuccess(res, { message: 'Đã khóa tài khoản người dùng thành công', data: disabled });
  } catch (err) {
    return next(err);
  }
};

// ============================================================================
// 3. QUẢN TRỊ CRUD ALBUM & ẢNH (/api/admin/albums)
// ============================================================================

/**
 * GET /api/admin/albums?trang_thai_album=
 */
const listAdminAlbums = async (req, res, next) => {
  try {
    let query = supabase
      .from('album')
      .select(`
        *,
        don_dat_lich:don_dat_lich_id (
          id,
          ma_don,
          ngay_chup,
          trang_thai_don,
          khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten, email, so_dien_thoai ),
          concept:concept_id ( id, ten_concept ),
          goi_dich_vu:goi_dich_vu_id ( id, ten_goi, so_anh_chinh_sua )
        )
      `)
      .order('ngay_tao', { ascending: false });

    if (req.query.trang_thai_album) {
      query = query.eq('trang_thai_album', String(req.query.trang_thai_album).trim());
    }

    const { data, error } = await query;
    if (error) throw new AppError(`Lỗi truy vấn danh sách album: ${error.message}`, 500, 'DATABASE_ERROR');

    return sendSuccess(res, {
      message: 'Lấy danh sách album toàn studio thành công',
      data: data || [],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/admin/albums/:id
 */
const getAdminAlbumDetail = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.id, 'ID album');

    const [{ data: album, error: aErr }, { data: photos, error: pErr }] = await Promise.all([
      supabase
        .from('album')
        .select(`
          *,
          don_dat_lich:don_dat_lich_id (
            id,
            ma_don,
            ngay_chup,
            trang_thai_don,
            khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten, email, so_dien_thoai ),
            concept:concept_id ( id, ten_concept ),
            goi_dich_vu:goi_dich_vu_id ( id, ten_goi, so_anh_chinh_sua )
          )
        `)
        .eq('id', albumId)
        .maybeSingle(),
      supabase.from('anh_album').select('*').eq('album_id', albumId).order('id', { ascending: true }),
    ]);

    if (aErr) throw new AppError(aErr.message, 500, 'DATABASE_ERROR');
    if (pErr) throw new AppError(pErr.message, 500, 'DATABASE_ERROR');
    if (!album) throw new AppError('Không tìm thấy album', 404, 'ALBUM_NOT_FOUND');

    const rawUrls = await resolveStorageUrls((photos || []).map((p) => p.duong_dan_anh_tho));
    const finalUrls = await resolveStorageUrls((photos || []).map((p) => p.duong_dan_anh_hoan_thien));

    const enrichedPhotos = (photos || []).map((p, idx) => ({
      ...p,
      url_anh_tho: rawUrls[idx],
      url_anh_hoan_thien: finalUrls[idx],
    }));

    return sendSuccess(res, {
      message: 'Lấy chi tiết album thành công',
      data: {
        album,
        anh: enrichedPhotos,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/albums
 */
const createAdminAlbum = async (req, res, next) => {
  try {
    const schema = z.object({
      don_dat_lich_id: z.coerce.number().int().positive('Vui lòng chọn đơn đặt lịch'),
      tieu_de: z.string().trim().min(2).max(200).optional(),
      so_anh_toi_da_duoc_chon: z.coerce.number().int().positive().optional(),
    });
    const parsed = schema.parse(req.body);

    const { data: booking, error: bErr } = await supabase
      .from('don_dat_lich')
      .select(`
        id,
        ma_don,
        concept:concept_id ( ten_concept ),
        khach_hang:nguoi_dung!khach_hang_id ( ho_ten ),
        goi_dich_vu:goi_dich_vu_id ( so_anh_chinh_sua )
      `)
      .eq('id', parsed.don_dat_lich_id)
      .maybeSingle();

    if (bErr) throw new AppError(bErr.message, 500, 'DATABASE_ERROR');
    if (!booking) throw new AppError('Không tìm thấy đơn đặt lịch', 404, 'BOOKING_NOT_FOUND');

    const { data: exists } = await supabase
      .from('album')
      .select('id')
      .eq('don_dat_lich_id', booking.id)
      .maybeSingle();
    if (exists) {
      throw new AppError('Đơn đặt lịch này đã có album rồi', 409, 'ALBUM_ALREADY_EXISTS');
    }

    const title =
      parsed.tieu_de ||
      `Album ${booking.concept?.ten_concept || booking.ma_don} - ${booking.khach_hang?.ho_ten || 'Khách hàng'}`;

    const { data: created, error } = await supabase
      .from('album')
      .insert([
        {
          don_dat_lich_id: booking.id,
          tieu_de: title,
          so_anh_toi_da_duoc_chon: parsed.so_anh_toi_da_duoc_chon || booking.goi_dich_vu?.so_anh_chinh_sua || 10,
          tong_so_anh_tho: 0,
          so_anh_da_chon: 0,
          trang_thai_album: 'cho_khach_duyet',
        },
      ])
      .select('*')
      .single();

    if (error) throw new AppError(`Lỗi tạo album: ${error.message}`, 400, 'CREATE_ALBUM_FAILED');

    return sendSuccess(res, { statusCode: 201, message: 'Tạo album mới thành công', data: created });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH / PUT /api/admin/albums/:id
 */
const updateAdminAlbum = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.id, 'ID album');
    const schema = z.object({
      tieu_de: z.string().trim().min(2).max(200).optional(),
      so_anh_toi_da_duoc_chon: z.coerce.number().int().positive().optional(),
      trang_thai_album: z.enum(ALBUM_STATUSES).optional(),
    });
    const parsed = schema.parse(req.body);

    if (Object.keys(parsed).length === 0) {
      throw new AppError('Không có dữ liệu cần cập nhật', 400, 'EMPTY_UPDATE');
    }

    const { data: updated, error } = await supabase
      .from('album')
      .update(parsed)
      .eq('id', albumId)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(`Lỗi cập nhật album: ${error.message}`, 400, 'UPDATE_ALBUM_FAILED');
    if (!updated) throw new AppError('Không tìm thấy album', 404, 'ALBUM_NOT_FOUND');

    return sendSuccess(res, { message: 'Cập nhật album thành công', data: updated });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/albums/:id
 */
const deleteAdminAlbum = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.id, 'ID album');

    const { data: photos } = await supabase
      .from('anh_album')
      .select('duong_dan_anh_tho, duong_dan_anh_hoan_thien')
      .eq('album_id', albumId);

    const storagePaths = [];
    for (const p of photos || []) {
      if (p.duong_dan_anh_tho) storagePaths.push(p.duong_dan_anh_tho);
      if (p.duong_dan_anh_hoan_thien) storagePaths.push(p.duong_dan_anh_hoan_thien);
    }

    await deleteFromStorage(storagePaths);
    await supabase.from('anh_album').delete().eq('album_id', albumId);

    const { data: deleted, error } = await supabase
      .from('album')
      .delete()
      .eq('id', albumId)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(`Lỗi xóa album: ${error.message}`, 400, 'DELETE_ALBUM_FAILED');
    if (!deleted) throw new AppError('Không tìm thấy album', 404, 'ALBUM_NOT_FOUND');

    return sendSuccess(res, { message: 'Đã xóa album và toàn bộ ảnh liên quan', data: deleted });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/albums/:albumId/photos/:photoId
 */
const deleteAdminAlbumPhoto = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.albumId, 'ID album');
    const photoId = parsePositiveId(req.params.photoId, 'ID ảnh');

    const { data: photo, error: findErr } = await supabase
      .from('anh_album')
      .select('*')
      .eq('id', photoId)
      .eq('album_id', albumId)
      .maybeSingle();

    if (findErr) throw new AppError(findErr.message, 500, 'DATABASE_ERROR');
    if (!photo) throw new AppError('Không tìm thấy ảnh trong album', 404, 'PHOTO_NOT_FOUND');

    await deleteFromStorage([photo.duong_dan_anh_tho, photo.duong_dan_anh_hoan_thien].filter(Boolean));
    await supabase.from('anh_album').delete().eq('id', photoId);

    const [{ count: totalRaw }, { count: totalSelected }] = await Promise.all([
      supabase.from('anh_album').select('id', { count: 'exact', head: true }).eq('album_id', albumId),
      supabase
        .from('anh_album')
        .select('id', { count: 'exact', head: true })
        .eq('album_id', albumId)
        .eq('duoc_chon', true),
    ]);

    await supabase
      .from('album')
      .update({
        tong_so_anh_tho: totalRaw || 0,
        so_anh_da_chon: totalSelected || 0,
      })
      .eq('id', albumId);

    return sendSuccess(res, {
      message: 'Đã xóa ảnh khỏi album thành công',
      data: {
        deleted_photo_id: photoId,
        tong_so_anh_tho: totalRaw || 0,
        so_anh_da_chon: totalSelected || 0,
      },
    });
  } catch (err) {
    return next(err);
  }
};

// ============================================================================
// 4. QUẢN TRỊ CRUD VOUCHER (/api/admin/vouchers)
// ============================================================================

/**
 * GET /api/admin/vouchers?da_su_dung=&khach_hang_id=&q=
 */
const listAdminVouchers = async (req, res, next) => {
  try {
    let query = supabase
      .from('voucher')
      .select(`
        *,
        khach_hang:nguoi_dung!khach_hang_id ( id, ho_ten, email, so_dien_thoai )
      `)
      .order('ngay_tao', { ascending: false });

    if (req.query.da_su_dung !== undefined) {
      query = query.eq('da_su_dung', String(req.query.da_su_dung) === 'true');
    }
    if (req.query.khach_hang_id) {
      query = query.eq('khach_hang_id', Number(req.query.khach_hang_id));
    }
    if (req.query.q) {
      query = query.ilike('ma_voucher', `%${String(req.query.q).trim()}%`);
    }

    const { data, error } = await query;
    if (error) throw new AppError(`Lỗi lấy danh sách voucher: ${error.message}`, 500, 'DATABASE_ERROR');

    return sendSuccess(res, { message: 'Lấy danh sách voucher thành công', data: data || [] });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/admin/vouchers
 */
const createAdminVoucher = async (req, res, next) => {
  try {
    const schema = z.object({
      khach_hang_id: z.coerce.number().int().positive('Vui lòng chọn khách hàng nhận voucher'),
      gia_tri: z.coerce.number().positive('Giá trị voucher phải lớn hơn 0'),
      ma_voucher: z.string().trim().min(4).max(50).optional(),
      han_su_dung: z.string().datetime({ offset: true }).optional(),
      so_thang_hieu_luc: z.coerce.number().int().min(1).max(24).optional().default(6),
    });
    const parsed = schema.parse(req.body);

    let expiryIso = parsed.han_su_dung;
    if (!expiryIso) {
      const d = new Date();
      d.setMonth(d.getMonth() + parsed.so_thang_hieu_luc);
      expiryIso = d.toISOString();
    }

    const code = parsed.ma_voucher ? parsed.ma_voucher.toUpperCase() : generateVoucherCode();

    const { data: created, error } = await supabase
      .from('voucher')
      .insert([
        {
          ma_voucher: code,
          khach_hang_id: parsed.khach_hang_id,
          gia_tri: parsed.gia_tri,
          han_su_dung: expiryIso,
          da_su_dung: false,
        },
      ])
      .select('*')
      .single();

    if (error) throw new AppError(`Lỗi tạo voucher: ${error.message}`, 400, 'CREATE_VOUCHER_FAILED');

    return sendSuccess(res, { statusCode: 201, message: 'Cấp mã voucher mới thành công', data: created });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH / PUT /api/admin/vouchers/:id
 */
const updateAdminVoucher = async (req, res, next) => {
  try {
    const voucherId = parsePositiveId(req.params.id, 'ID voucher');
    const schema = z.object({
      gia_tri: z.coerce.number().positive().optional(),
      han_su_dung: z.string().datetime({ offset: true }).optional(),
      da_su_dung: z.boolean().optional(),
    });
    const parsed = schema.parse(req.body);

    if (Object.keys(parsed).length === 0) {
      throw new AppError('Không có dữ liệu cần cập nhật', 400, 'EMPTY_UPDATE');
    }

    const { data: updated, error } = await supabase
      .from('voucher')
      .update(parsed)
      .eq('id', voucherId)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(`Lỗi cập nhật voucher: ${error.message}`, 400, 'UPDATE_VOUCHER_FAILED');
    if (!updated) throw new AppError('Không tìm thấy voucher', 404, 'VOUCHER_NOT_FOUND');

    return sendSuccess(res, { message: 'Cập nhật voucher thành công', data: updated });
  } catch (err) {
    return next(err);
  }
};

/**
 * DELETE /api/admin/vouchers/:id
 */
const deleteAdminVoucher = async (req, res, next) => {
  try {
    const voucherId = parsePositiveId(req.params.id, 'ID voucher');

    const { data: deleted, error } = await supabase
      .from('voucher')
      .delete()
      .eq('id', voucherId)
      .select('*')
      .maybeSingle();

    if (error) throw new AppError(`Lỗi xóa voucher: ${error.message}`, 400, 'DELETE_VOUCHER_FAILED');
    if (!deleted) throw new AppError('Không tìm thấy voucher', 404, 'VOUCHER_NOT_FOUND');

    return sendSuccess(res, { message: 'Đã xóa voucher thành công', data: deleted });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listCatalogItems,
  getCatalogItemDetail,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  listAdminAlbums,
  getAdminAlbumDetail,
  createAdminAlbum,
  updateAdminAlbum,
  deleteAdminAlbum,
  deleteAdminAlbumPhoto,
  listAdminVouchers,
  createAdminVoucher,
  updateAdminVoucher,
  deleteAdminVoucher,
};
