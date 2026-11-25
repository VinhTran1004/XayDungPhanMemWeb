const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');
const { resolveStorageUrls } = require('../services/storageService');

const EXTRA_PHOTO_PRICE = 50000;

const updatePhotoSelectionSchema = z
  .object({
    duoc_chon: z.boolean().optional(),
    ghi_chu_khach: z.string().trim().max(500, 'Ghi chú chỉnh sửa tối đa 500 ký tự').optional().nullable(),
  })
  .refine((data) => data.duoc_chon !== undefined || data.ghi_chu_khach !== undefined, {
    message: 'Vui lòng cung cấp trạng thái chọn hoặc ghi chú chỉnh sửa',
  });

const parsePositiveId = (rawId, label = 'ID') => {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(`${label} không hợp lệ`, 400, 'INVALID_ID');
  }
  return id;
};

const computeAlbumSummary = (album) => {
  const limit = Number(album.so_anh_toi_da_duoc_chon || 0);
  const selected = Number(album.so_anh_da_chon || 0);
  const extraCount = Math.max(0, selected - limit);
  return {
    so_anh_toi_da_duoc_chon: limit,
    so_anh_da_chon: selected,
    so_anh_vuot_dinh_muc: extraCount,
    don_gia_anh_them: EXTRA_PHOTO_PRICE,
    phu_phi_anh_them_du_kien: extraCount * EXTRA_PHOTO_PRICE,
  };
};

const attachSignedUrls = async (photos, { download = false } = {}) => {
  if (!photos || photos.length === 0) return [];
  const rawPaths = photos.map((p) => p.duong_dan_anh_tho);
  const finalPaths = photos.map((p) => p.duong_dan_anh_hoan_thien);

  const [rawUrls, finalUrls] = await Promise.all([
    resolveStorageUrls(rawPaths, { expiresIn: 3600, download: false }),
    resolveStorageUrls(finalPaths, { expiresIn: 3600, download }),
  ]);

  return photos.map((p, idx) => ({
    ...p,
    url_anh_tho: rawUrls[idx],
    url_anh_hoan_thien: finalUrls[idx],
  }));
};

const fetchAuthorizedAlbum = async ({ albumId = null, donDatLichId = null }, user, { allowAdmin = true } = {}) => {
  let query = supabase.from('album').select(`
    *,
    don_dat_lich:don_dat_lich_id (
      id,
      ma_don,
      khach_hang_id,
      ngay_chup,
      tong_tien,
      tien_coc,
      tien_con_lai,
      trang_thai_don,
      trang_thai_thanh_toan,
      concept:concept_id ( id, ten_concept ),
      goi_dich_vu:goi_dich_vu_id ( id, ten_goi, ma_goi, so_anh_chinh_sua )
    )
  `);

  query = albumId ? query.eq('id', albumId) : query.eq('don_dat_lich_id', donDatLichId);
  const { data: album, error } = await query.maybeSingle();

  if (error) {
    throw new AppError(`Lỗi truy vấn album: ${error.message}`, 500, 'DATABASE_ERROR');
  }
  if (!album || !album.don_dat_lich) {
    throw new AppError('Không tìm thấy album ảnh', 404, 'ALBUM_NOT_FOUND');
  }

  const isOwner = album.don_dat_lich.khach_hang_id === user.id;
  const isAdmin = allowAdmin && user.vai_tro === 'quan_tri_vien';
  if (!isOwner && !isAdmin) {
    throw new AppError('Bạn không có quyền truy cập album ảnh này', 403, 'FORBIDDEN');
  }

  return album;
};

/**
 * GET /api/albums/my-albums
 */
const getMyAlbums = async (req, res, next) => {
  try {
    const { data: bookings, error: bErr } = await supabase
      .from('don_dat_lich')
      .select(`
        id,
        ma_don,
        ngay_chup,
        trang_thai_don,
        concept:concept_id ( id, ten_concept, hinh_dai_dien ),
        goi_dich_vu:goi_dich_vu_id ( id, ten_goi, ma_goi, so_anh_chinh_sua )
      `)
      .eq('khach_hang_id', req.user.id)
      .order('ngay_tao', { ascending: false });

    if (bErr) {
      throw new AppError(`Lỗi truy vấn đơn đặt lịch: ${bErr.message}`, 500, 'DATABASE_ERROR');
    }

    const bookingIds = (bookings || []).map((b) => b.id);
    if (bookingIds.length === 0) {
      return sendSuccess(res, { message: 'Lấy danh sách album thành công', data: [] });
    }

    const { data: albums, error: aErr } = await supabase
      .from('album')
      .select('*')
      .in('don_dat_lich_id', bookingIds)
      .order('ngay_tao', { ascending: false });

    if (aErr) {
      throw new AppError(`Lỗi truy vấn album: ${aErr.message}`, 500, 'DATABASE_ERROR');
    }

    const bookingMap = new Map(bookings.map((b) => [b.id, b]));
    const enriched = (albums || []).map((album) => ({
      ...album,
      ...computeAlbumSummary(album),
      don_dat_lich: bookingMap.get(album.don_dat_lich_id) || null,
    }));

    return sendSuccess(res, {
      message: 'Lấy danh sách album của tôi thành công',
      data: enriched,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/albums/:donDatLichId
 */
const getAlbumByBooking = async (req, res, next) => {
  try {
    const donDatLichId = parsePositiveId(req.params.donDatLichId, 'ID đơn đặt lịch');
    const album = await fetchAuthorizedAlbum({ donDatLichId }, req.user);

    const { data: photos, error: pErr } = await supabase
      .from('anh_album')
      .select('*')
      .eq('album_id', album.id)
      .order('id', { ascending: true });

    if (pErr) {
      throw new AppError(`Lỗi truy vấn ảnh trong album: ${pErr.message}`, 500, 'DATABASE_ERROR');
    }

    const photosWithUrls = await attachSignedUrls(photos || []);

    return sendSuccess(res, {
      message: 'Lấy chi tiết cổng duyệt ảnh thành công',
      data: {
        album: {
          ...album,
          ...computeAlbumSummary(album),
        },
        anh: photosWithUrls,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PATCH /api/albums/:albumId/photos/:photoId
 */
const updatePhotoSelection = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.albumId, 'ID album');
    const photoId = parsePositiveId(req.params.photoId, 'ID ảnh');
    const parsed = updatePhotoSelectionSchema.parse(req.body || {});

    const album = await fetchAuthorizedAlbum({ albumId }, req.user, { allowAdmin: false });
    if (album.trang_thai_album !== 'cho_khach_duyet') {
      throw new AppError('Album đã được chốt hoặc bàn giao, không thể thay đổi lựa chọn ảnh', 400, 'ALBUM_LOCKED');
    }

    const { data: existingPhoto, error: findErr } = await supabase
      .from('anh_album')
      .select('*')
      .eq('id', photoId)
      .eq('album_id', album.id)
      .maybeSingle();

    if (findErr) {
      throw new AppError(`Lỗi truy vấn ảnh: ${findErr.message}`, 500, 'DATABASE_ERROR');
    }
    if (!existingPhoto) {
      throw new AppError('Không tìm thấy ảnh trong album này', 404, 'PHOTO_NOT_FOUND');
    }

    const updateFields = {};
    if (parsed.duoc_chon !== undefined) updateFields.duoc_chon = parsed.duoc_chon;
    if (parsed.ghi_chu_khach !== undefined) updateFields.ghi_chu_khach = parsed.ghi_chu_khach;

    const { data: updatedPhoto, error: upErr } = await supabase
      .from('anh_album')
      .update(updateFields)
      .eq('id', photoId)
      .select('*')
      .single();

    if (upErr) {
      throw new AppError(`Lỗi cập nhật lựa chọn ảnh: ${upErr.message}`, 500, 'DATABASE_ERROR');
    }

    const { count: selectedCount, error: countErr } = await supabase
      .from('anh_album')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', album.id)
      .eq('duoc_chon', true);

    if (countErr) {
      throw new AppError(`Lỗi đếm số ảnh đã chọn: ${countErr.message}`, 500, 'DATABASE_ERROR');
    }

    const newCount = selectedCount || 0;
    await supabase.from('album').update({ so_anh_da_chon: newCount }).eq('id', album.id);

    const [photoWithUrl] = await attachSignedUrls([updatedPhoto]);
    const summary = computeAlbumSummary({ ...album, so_anh_da_chon: newCount });

    return sendSuccess(res, {
      message: 'Cập nhật lựa chọn ảnh thành công',
      data: {
        anh: photoWithUrl,
        thong_ke: summary,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/albums/:albumId/submit
 */
const submitAlbumSelection = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.albumId, 'ID album');
    const album = await fetchAuthorizedAlbum({ albumId }, req.user, { allowAdmin: false });

    if (album.trang_thai_album !== 'cho_khach_duyet') {
      throw new AppError('Album này đã được xác nhận gửi chỉnh sửa trước đó', 400, 'ALBUM_ALREADY_SUBMITTED');
    }

    const { count: selectedCount, error: countErr } = await supabase
      .from('anh_album')
      .select('id', { count: 'exact', head: true })
      .eq('album_id', album.id)
      .eq('duoc_chon', true);

    if (countErr) {
      throw new AppError(`Lỗi đếm số ảnh đã chọn: ${countErr.message}`, 500, 'DATABASE_ERROR');
    }

    const totalSelected = selectedCount || 0;
    if (totalSelected <= 0) {
      throw new AppError('Vui lòng chọn ít nhất 1 ảnh trước khi gửi chỉnh sửa', 400, 'NO_PHOTOS_SELECTED');
    }

    const nowIso = new Date().toISOString();
    const { data: lockedAlbum, error: lockErr } = await supabase
      .from('album')
      .update({
        so_anh_da_chon: totalSelected,
        trang_thai_album: 'da_chot_chon_anh',
        thoi_gian_chot_anh: nowIso,
      })
      .eq('id', album.id)
      .eq('trang_thai_album', 'cho_khach_duyet')
      .select('*')
      .maybeSingle();

    if (lockErr || !lockedAlbum) {
      throw new AppError('Không thể chốt album, album có thể đã được gửi trước đó', 409, 'ALBUM_LOCK_CONFLICT');
    }

    const summary = computeAlbumSummary(lockedAlbum);
    const extraFee = summary.phu_phi_anh_them_du_kien;
    const bookingUpdate = {
      trang_thai_don: 'dang_chinh_sua',
    };

    if (extraFee > 0) {
      bookingUpdate.tong_tien = Number(album.don_dat_lich.tong_tien) + extraFee;
      bookingUpdate.tien_con_lai = Number(album.don_dat_lich.tien_con_lai) + extraFee;
      bookingUpdate.ghi_chu_noi_bo = `Khách chọn vượt ${summary.so_anh_vuot_dinh_muc} ảnh (+${extraFee} VNĐ)`;
    }

    const { error: bookErr } = await supabase
      .from('don_dat_lich')
      .update(bookingUpdate)
      .eq('id', album.don_dat_lich_id);

    if (bookErr) {
      throw new AppError(`Lỗi cập nhật đơn đặt lịch: ${bookErr.message}`, 500, 'DATABASE_ERROR');
    }

    return sendSuccess(res, {
      message: 'Đã chốt danh sách ảnh gửi hậu kỳ! Studio sẽ chỉnh sửa và bàn giao trong 2–3 ngày tới',
      data: {
        album: { ...lockedAlbum, ...summary },
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/albums/:albumId/download
 */
const downloadFinalAlbum = async (req, res, next) => {
  try {
    const albumId = parsePositiveId(req.params.albumId, 'ID album');
    const album = await fetchAuthorizedAlbum({ albumId }, req.user);

    if (album.trang_thai_album !== 'da_ban_giao') {
      throw new AppError('Album chưa hoàn thiện hậu kỳ để tải về', 400, 'ALBUM_NOT_DELIVERED');
    }

    const { data: photos, error } = await supabase
      .from('anh_album')
      .select('*')
      .eq('album_id', album.id)
      .not('duong_dan_anh_hoan_thien', 'is', null)
      .order('id', { ascending: true });

    if (error) {
      throw new AppError(`Lỗi lấy danh sách ảnh hoàn thiện: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    const photosWithDownloadUrls = await attachSignedUrls(photos || [], { download: true });

    return sendSuccess(res, {
      message: 'Lấy danh sách link tải ảnh hoàn thiện thành công',
      data: {
        album_id: album.id,
        tieu_de: album.tieu_de,
        tong_so_anh_hoan_thien: photosWithDownloadUrls.length,
        anh_hoan_thien: photosWithDownloadUrls.map((p) => ({
          id: p.id,
          ghi_chu_khach: p.ghi_chu_khach,
          download_url: p.url_anh_hoan_thien,
        })),
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  EXTRA_PHOTO_PRICE,
  getMyAlbums,
  getAlbumByBooking,
  updatePhotoSelection,
  submitAlbumSelection,
  downloadFinalAlbum,
};
