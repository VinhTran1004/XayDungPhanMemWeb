const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');

const CONCEPT_SELECT = `
  id,
  danh_muc_id,
  phong_chup_id,
  ten_concept,
  duong_dan_concept,
  mo_ta,
  hinh_dai_dien,
  danh_sach_hinh_mau,
  goi_y_trang_phuc,
  trang_thai,
  danh_muc_dich_vu ( id, ten_danh_muc, duong_dan_danh_muc ),
  phong_chup ( id, ten_phong, phong_cach )
`;

/**
 * Fetch active rows from a simple catalog table with consistent ordering and error handling.
 */
const fetchActiveCatalog = async ({ table, select = '*', orderBy = 'id', ascending = true }) => {
  const { data, error } = await supabase
    .from(table)
    .select(select)
    .eq('trang_thai', true)
    .order(orderBy, { ascending });

  if (error) {
    throw new AppError(`Lỗi truy vấn ${table}: ${error.message}`, 500, 'DATABASE_ERROR');
  }
  return data || [];
};

/**
 * Sanitize free-text search term before embedding inside PostgREST `.or()` filter.
 */
const sanitizeSearchTerm = (raw) =>
  String(raw || '')
    .trim()
    .replace(/[%_,()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * GET /api/catalog/home
 * API tổng hợp cho Trang chủ (1 request lấy toàn bộ dữ liệu hiển thị ban đầu):
 * - danh_muc: Danh mục dịch vụ kèm số lượng concept thuộc danh mục đó
 * - concepts_noi_bat: Tối đa 8 concept đang hoạt động kèm thông tin danh mục & phòng chụp
 * - goi_dich_vu: Bảng giá 3 gói chụp (Basic, Standard, VIP)
 * - phong_chup: 3 phòng chụp vật lý của studio
 */
const getHomeData = async (req, res, next) => {
  try {
    const [categories, concepts, packages, rooms] = await Promise.all([
      fetchActiveCatalog({ table: 'danh_muc_dich_vu', orderBy: 'id' }),
      fetchActiveCatalog({ table: 'concept', select: CONCEPT_SELECT, orderBy: 'id' }),
      fetchActiveCatalog({ table: 'goi_dich_vu', orderBy: 'gia_co_ban' }),
      fetchActiveCatalog({ table: 'phong_chup', orderBy: 'id' }),
    ]);

    const conceptCountByCategory = new Map();
    for (const c of concepts) {
      conceptCountByCategory.set(c.danh_muc_id, (conceptCountByCategory.get(c.danh_muc_id) || 0) + 1);
    }

    const enrichedCategories = categories.map((cat) => ({
      ...cat,
      so_luong_concept: conceptCountByCategory.get(cat.id) || 0,
    }));

    return sendSuccess(res, {
      message: 'Lấy dữ liệu tổng hợp trang chủ thành công',
      data: {
        danh_muc: enrichedCategories,
        concepts_noi_bat: concepts.slice(0, 8),
        goi_dich_vu: packages,
        phong_chup: rooms,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/categories?include_concepts=true
 * Truy xuất danh sách danh mục dịch vụ (Chụp cá nhân, Cặp đôi, Sinh nhật...) kèm `so_luong_concept`.
 * Nếu truyền `include_concepts=true`, mỗi danh mục sẽ kèm thêm mảng `concepts` con để render từng section.
 */
const getCategories = async (req, res, next) => {
  try {
    const includeConcepts = String(req.query.include_concepts || '').toLowerCase() === 'true';

    const [categories, concepts] = await Promise.all([
      fetchActiveCatalog({ table: 'danh_muc_dich_vu', orderBy: 'id' }),
      fetchActiveCatalog({
        table: 'concept',
        select: includeConcepts ? CONCEPT_SELECT : 'id, danh_muc_id',
        orderBy: 'id',
      }),
    ]);

    const conceptsByCategory = new Map();
    for (const c of concepts) {
      if (!conceptsByCategory.has(c.danh_muc_id)) {
        conceptsByCategory.set(c.danh_muc_id, []);
      }
      conceptsByCategory.get(c.danh_muc_id).push(c);
    }

    const data = categories.map((cat) => {
      const catConcepts = conceptsByCategory.get(cat.id) || [];
      const item = {
        ...cat,
        so_luong_concept: catConcepts.length,
      };
      if (includeConcepts) {
        item.concepts = catConcepts;
      }
      return item;
    });

    return sendSuccess(res, {
      message: 'Lấy danh sách danh mục dịch vụ thành công',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/concepts?danh_muc_id=&duong_dan_danh_muc=&phong_chup_id=&q=&page=&limit=
 * Truy xuất danh sách Concept nghệ thuật để hiển thị trang Portfolio / Sản phẩm.
 * Hỗ trợ lọc theo danh mục, lọc theo phòng chụp, tìm kiếm từ khóa (`q` hoặc `search`) và phân trang.
 */
const getConcepts = async (req, res, next) => {
  try {
    const { danh_muc_id, duong_dan_danh_muc, phong_chup_id } = req.query;
    const rawSearch = req.query.q ?? req.query.search;
    const searchTerm = sanitizeSearchTerm(rawSearch);

    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 12));

    let query = supabase
      .from('concept')
      .select(CONCEPT_SELECT, { count: 'exact' })
      .eq('trang_thai', true)
      .order('id', { ascending: true });

    if (danh_muc_id) {
      const categoryId = Number(danh_muc_id);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new AppError('danh_muc_id không hợp lệ', 400, 'INVALID_QUERY_PARAM');
      }
      query = query.eq('danh_muc_id', categoryId);
    }

    if (phong_chup_id) {
      const roomId = Number(phong_chup_id);
      if (!Number.isInteger(roomId) || roomId <= 0) {
        throw new AppError('phong_chup_id không hợp lệ', 400, 'INVALID_QUERY_PARAM');
      }
      query = query.eq('phong_chup_id', roomId);
    }

    if (duong_dan_danh_muc) {
      const { data: category, error: catError } = await supabase
        .from('danh_muc_dich_vu')
        .select('id')
        .eq('duong_dan_danh_muc', String(duong_dan_danh_muc).trim())
        .eq('trang_thai', true)
        .maybeSingle();

      if (catError) {
        throw new AppError(`Lỗi tìm danh mục: ${catError.message}`, 500, 'DATABASE_ERROR');
      }
      if (!category) {
        return sendSuccess(res, {
          message: 'Lấy danh sách concept thành công',
          data: [],
          meta: { page, limit, total: 0, total_pages: 0 },
        });
      }
      query = query.eq('danh_muc_id', category.id);
    }

    if (searchTerm) {
      query = query.or(`ten_concept.ilike.%${searchTerm}%,mo_ta.ilike.%${searchTerm}%`);
    }

    if (hasPagination) {
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);
    }

    const { data, error, count } = await query;
    if (error) {
      throw new AppError(`Lỗi truy vấn concept: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    const total = count || 0;
    return sendSuccess(res, {
      message: 'Lấy danh sách concept thành công',
      data: data || [],
      meta: hasPagination
        ? { page, limit, total, total_pages: Math.ceil(total / limit) }
        : { total },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/concepts/:slugOrId
 * Truy xuất chi tiết 1 Concept (theo ID hoặc slug `duong_dan_concept`):
 * - Thông tin concept, bộ ảnh mẫu (`danh_sach_hinh_mau`), gợi ý trang phục, phòng chụp mặc định
 * - `concepts_lien_quan`: Tối đa 4 concept khác cùng danh mục
 * - `goi_dich_vu`: Danh sách gói quy mô áp dụng để hiển thị kèm trên trang chi tiết
 */
const getConceptDetail = async (req, res, next) => {
  try {
    const { slugOrId } = req.params;
    const isNumericId = /^\d+$/.test(slugOrId);

    let query = supabase
      .from('concept')
      .select(`
        id,
        danh_muc_id,
        phong_chup_id,
        ten_concept,
        duong_dan_concept,
        mo_ta,
        hinh_dai_dien,
        danh_sach_hinh_mau,
        goi_y_trang_phuc,
        trang_thai,
        danh_muc_dich_vu ( id, ten_danh_muc, duong_dan_danh_muc, mo_ta ),
        phong_chup ( id, ten_phong, phong_cach, mo_ta )
      `)
      .eq('trang_thai', true);

    query = isNumericId
      ? query.eq('id', Number(slugOrId))
      : query.eq('duong_dan_concept', slugOrId);

    const { data, error } = await query.maybeSingle();
    if (error) {
      throw new AppError(`Lỗi truy vấn chi tiết concept: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    if (!data) {
      throw new AppError('Không tìm thấy concept yêu cầu', 404, 'CONCEPT_NOT_FOUND');
    }

    const [{ data: relatedConcepts, error: relErr }, packages] = await Promise.all([
      supabase
        .from('concept')
        .select(CONCEPT_SELECT)
        .eq('trang_thai', true)
        .eq('danh_muc_id', data.danh_muc_id)
        .neq('id', data.id)
        .order('id', { ascending: true })
        .limit(4),
      fetchActiveCatalog({ table: 'goi_dich_vu', orderBy: 'gia_co_ban' }),
    ]);

    if (relErr) {
      throw new AppError(`Lỗi truy vấn concept liên quan: ${relErr.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Lấy chi tiết concept thành công',
      data: {
        ...data,
        concepts_lien_quan: relatedConcepts || [],
        goi_dich_vu: packages,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/packages
 * Truy xuất danh sách gói dịch vụ (Basic, Standard, VIP) sắp xếp theo giá tăng dần.
 */
const getPackages = async (req, res, next) => {
  try {
    const data = await fetchActiveCatalog({ table: 'goi_dich_vu', orderBy: 'gia_co_ban' });
    return sendSuccess(res, {
      message: 'Lấy danh sách gói dịch vụ thành công',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/addons
 * Truy xuất danh sách dịch vụ cộng thêm (Makeup, thêm người, nhận toàn bộ file gốc, photobook...).
 */
const getAddons = async (req, res, next) => {
  try {
    const data = await fetchActiveCatalog({ table: 'dich_vu_cong_them', orderBy: 'id' });
    return sendSuccess(res, {
      message: 'Lấy danh sách dịch vụ cộng thêm thành công',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/time-slots
 * Truy xuất 6 khung giờ chụp cố định trong ngày của studio (08:30 - 21:00).
 */
const getTimeSlots = async (req, res, next) => {
  try {
    const data = await fetchActiveCatalog({ table: 'khung_gio_chup', orderBy: 'gio_bat_dau' });
    return sendSuccess(res, {
      message: 'Lấy danh sách khung giờ chụp thành công',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/rooms
 * Truy xuất 3 phòng chụp vật lý của studio để hiển thị trang Không gian Studio.
 */
const getRooms = async (req, res, next) => {
  try {
    const data = await fetchActiveCatalog({ table: 'phong_chup', orderBy: 'id' });
    return sendSuccess(res, {
      message: 'Lấy danh sách phòng chụp thành công',
      data,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/catalog/photographers
 * Truy xuất danh sách công khai đội ngũ nhiếp ảnh gia (`vai_tro = 'tho_chup'`) cho trang Giới thiệu.
 * Không trả về email, số điện thoại hay mật khẩu.
 */
const getPublicPhotographers = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('nguoi_dung')
      .select('id, ho_ten, anh_dai_dien')
      .eq('vai_tro', 'tho_chup')
      .eq('trang_thai', true)
      .order('id', { ascending: true });

    if (error) {
      throw new AppError(`Lỗi truy vấn danh sách nhiếp ảnh gia: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Lấy danh sách đội ngũ nhiếp ảnh gia thành công',
      data: data || [],
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getHomeData,
  getCategories,
  getConcepts,
  getConceptDetail,
  getPackages,
  getAddons,
  getTimeSlots,
  getRooms,
  getPublicPhotographers,
};
