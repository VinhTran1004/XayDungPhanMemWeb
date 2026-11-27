import React, { useState, useEffect } from 'react';
import { albumApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Image,
  Check,
  CheckCircle2,
  Sparkles,
  Download,
  AlertTriangle,
  Send,
  Eye,
  Maximize2,
  X,
  MessageSquare,
} from 'lucide-react';

export default function AlbumsView({ initialBookingId }) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePhotoModal, setActivePhotoModal] = useState(null);

  // Load albums
  useEffect(() => {
    async function loadAlbums() {
      if (!user) {
        setLoading(false);
        return;
      }
      try {
        const res = await albumApi.getMyAlbums();
        if (res.success && res.data) {
          setAlbums(res.data);
          if (res.data.length > 0) {
            // Find by initialBookingId if provided
            const target = initialBookingId
              ? res.data.find((a) => a.don_dat_lich_id === initialBookingId) || res.data[0]
              : res.data[0];
            loadAlbumDetail(target.don_dat_lich_id || target.id);
          }
        }
      } catch (err) {
        console.error('Lỗi tải danh sách album:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAlbums();
  }, [user, initialBookingId]);

  const loadAlbumDetail = async (donDatLichId) => {
    setLoading(true);
    try {
      const res = await albumApi.getAlbumByBookingId(donDatLichId);
      if (res.success && res.data) {
        setSelectedAlbum(res.data);
      }
    } catch (err) {
      showToast(err.message || 'Không thể tải chi tiết album ảnh', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 🎓 TÍNH NĂNG CHỌN ẢNH & LƯU GHI CHÚ CHỈNH SỬA (REAL-TIME SELECTION)
  // - API gọi: PATCH /api/albums/:albumId/photos/:photoId
  // - Body gửi lên: { duoc_chon: true/false, ghi_chu_khach: "bóp eo, mịn da..." }
  // - Điểm đặc sắc: Backend tự tính toán số ảnh đã chọn so với số ảnh theo gói.
  //   Nếu chọn vượt gói (ví dụ gói VIP 35 ảnh mà chọn 37 ảnh), Backend tự tính
  //   phụ phí phát sinh: 50.000 VNĐ / ảnh thêm.
  // =========================================================================
  const handleToggleSelectPhoto = async (photo) => {
    if (!selectedAlbum) return;
    const newSelected = !photo.duoc_chon;

    try {
      const res = await albumApi.updatePhotoSelection(selectedAlbum.id, photo.id, {
        duoc_chon: newSelected,
        ghi_chu_khach: photo.ghi_chu_khach || '',
      });

      if (res.success) {
        // Update local state
        setSelectedAlbum((prev) => ({
          ...prev,
          so_anh_da_chon: res.data?.so_anh_da_chon ?? (newSelected ? prev.so_anh_da_chon + 1 : prev.so_anh_da_chon - 1),
          phu_phi_anh_them_du_kien: res.data?.phu_phi_anh_them_du_kien ?? prev.phu_phi_anh_them_du_kien,
          anh: prev.anh.map((p) =>
            p.id === photo.id ? { ...p, duoc_chon: newSelected } : p
          ),
        }));
      }
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật chọn ảnh', 'error');
    }
  };

  // Update photo photoshop note
  const handleSavePhotoNote = async (photoId, note) => {
    if (!selectedAlbum) return;
    try {
      await albumApi.updatePhotoSelection(selectedAlbum.id, photoId, {
        ghi_chu_khach: note,
      });
      setSelectedAlbum((prev) => ({
        ...prev,
        anh: prev.anh.map((p) =>
          p.id === photoId ? { ...p, ghi_chu_khach: note } : p
        ),
      }));
      showToast('Đã lưu ghi chú chỉnh sửa', 'info');
    } catch (err) {
      showToast(err.message || 'Lỗi lưu ghi chú', 'error');
    }
  };

  // =========================================================================
  // 🎓 CHỐT DANH SÁCH ẢNH & GỬI BỘ PHẬN PHOTOSHOP (SUBMIT RETOUCHING)
  // - API gọi: POST /api/albums/:albumId/submit
  // - Nghiệp vụ: Chuyển trạng thái album sang 'da_chot_chon_anh'.
  //   Lúc này giao diện sẽ KHÓA tính năng thay đổi ảnh của khách, đồng thời
  //   nếu có phụ phí chọn thêm ảnh sẽ tự động cộng vào khoản tiền 70% còn lại.
  // =========================================================================
  const handleSubmitRetouching = async () => {
    if (!selectedAlbum) return;
    if (selectedAlbum.so_anh_da_chon === 0) {
      showToast('Vui lòng chọn ít nhất 1 ảnh để gửi thợ Photoshop', 'warning');
      return;
    }

    try {
      const res = await albumApi.submitAlbum(selectedAlbum.id);
      if (res.success) {
        showToast('Chốt danh sách chọn ảnh thành công! Đã chuyển cho bộ phận Photoshop.', 'success');
        setSelectedAlbum((prev) => ({ ...prev, trang_thai: 'da_chot_chon_anh' }));
      }
    } catch (err) {
      showToast(err.message || 'Không thể chốt danh sách chọn ảnh', 'error');
    }
  };

  if (!user) {
    return (
      <div className="container section-padding text-center">
        <div className="empty-state-box">
          <Image size={48} color="var(--gold-primary)" />
          <h2 className="font-serif">Cổng Duyệt Ảnh Khách Hàng</h2>
          <p>Vui lòng đăng nhập để xem toàn bộ album ảnh thô và chọn ảnh photoshop tại nhà.</p>
          <button className="btn-primary" onClick={() => openAuthModal('login')}>
            Đăng Nhập Ngay
          </button>
        </div>
      </div>
    );
  }

  const maxPhotosAllowed = selectedAlbum?.so_anh_toi_da_duoc_chon || 10;
  const currentSelectedCount = selectedAlbum?.so_anh_da_chon || 0;
  const excessCount = Math.max(0, currentSelectedCount - maxPhotosAllowed);
  const excessFee = excessCount * 50000;
  const isLocked = selectedAlbum?.trang_thai === 'da_chot_chon_anh' || selectedAlbum?.trang_thai === 'da_ban_giao';

  return (
    <div className="container section-padding proofing-page">
      <div className="section-header text-center">
        <div className="badge badge-gold">Cổng Chọn Ảnh Studio Tại Nhà</div>
        <h1 className="section-title font-serif">Duyệt & Chọn Ảnh Chỉnh Sửa</h1>
        <p className="section-subtitle">
          Tick chọn những khoảnh khắc bạn ưng ý nhất và ghi chú yêu cầu photoshop (bóp eo, mịn da, chỉnh màu...)
        </p>

        {/* Album selector tabs */}
        {albums.length > 1 && (
          <div className="tabs-header-center">
            {albums.map((alb) => (
              <button
                key={alb.id}
                className={`tab-btn-pill ${selectedAlbum?.id === alb.id ? 'active' : ''}`}
                onClick={() => loadAlbumDetail(alb.don_dat_lich_id || alb.id)}
              >
                Album #{alb.don_dat_lich?.ma_don || alb.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedAlbum ? (
        <div className="empty-state-box">
          <Image size={48} color="var(--gold-primary)" />
          <h3 className="font-serif">Chưa Có Album Ảnh Nào</h3>
          <p>Khi buổi chụp hoàn tất, Studio sẽ upload ảnh thô lên đây để bạn thoải mái chọn lọc.</p>
        </div>
      ) : (
        <>
          {/* STICKY CONTROL PANEL */}
          <div className="proofing-sticky-bar">
            <div className="proofing-stats">
              <div className="stat-pill">
                <span>Số ảnh đã chọn:</span>
                <strong className="text-gold">
                  {currentSelectedCount} / {maxPhotosAllowed} ảnh
                </strong>
              </div>

              {excessCount > 0 && (
                <div className="excess-warning-pill">
                  <AlertTriangle size={16} />
                  <span>
                    Vượt gói +{excessCount} ảnh (+{new Intl.NumberFormat('vi-VN').format(excessFee)} đ)
                  </span>
                </div>
              )}
            </div>

            <div className="proofing-actions">
              {selectedAlbum.trang_thai === 'da_ban_giao' ? (
                <button
                  className="btn-primary"
                  onClick={async () => {
                    const res = await albumApi.getDownloadUrls(selectedAlbum.id);
                    if (res.success && res.data?.urls) {
                      showToast(`Sẵn sàng tải ${res.data.urls.length} ảnh độ nét cao!`, 'success');
                    }
                  }}
                >
                  <Download size={16} /> Tải Về Ảnh Hoàn Thiện Gốc
                </button>
              ) : isLocked ? (
                <div className="badge badge-sky">
                  <CheckCircle2 size={16} /> Đã Chốt Danh Sách - Đang Hậu Kỳ
                </div>
              ) : (
                <button
                  className="btn-primary"
                  onClick={handleSubmitRetouching}
                >
                  <Send size={16} /> Chốt Danh Sách & Gửi Photoshop
                </button>
              )}
            </div>
          </div>

          {/* PHOTOS GRID */}
          <div className="proofing-grid">
            {selectedAlbum.anh?.map((photo, idx) => (
              <div
                key={photo.id || idx}
                className={`photo-proof-card ${photo.duoc_chon ? 'selected' : ''}`}
              >
                <div className="photo-proof-img-box">
                  <img
                    src={photo.url_anh_tho || photo.url_anh_hoan_thien}
                    alt={`Photo #${idx + 1}`}
                    loading="lazy"
                  />
                  <button
                    className="photo-zoom-btn"
                    onClick={() => setActivePhotoModal(photo)}
                    title="Phóng to xem chi tiết"
                  >
                    <Maximize2 size={16} />
                  </button>

                  {!isLocked && (
                    <button
                      className={`select-check-btn ${photo.duoc_chon ? 'active' : ''}`}
                      onClick={() => handleToggleSelectPhoto(photo)}
                    >
                      <Check size={16} />
                    </button>
                  )}
                </div>

                <div className="photo-proof-footer">
                  <div className="photo-index">Ảnh #{idx + 1}</div>
                  {!isLocked ? (
                    <input
                      type="text"
                      className="photo-note-input"
                      placeholder="Ghi chú sửa (bóp eo, mịn da...)"
                      defaultValue={photo.ghi_chu_khach || ''}
                      onBlur={(e) => {
                        if (e.target.value !== photo.ghi_chu_khach) {
                          handleSavePhotoNote(photo.id, e.target.value);
                        }
                      }}
                    />
                  ) : (
                    photo.ghi_chu_khach && (
                      <div className="photo-locked-note">
                        <MessageSquare size={12} /> {photo.ghi_chu_khach}
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* LIGHTBOX MODAL */}
      {activePhotoModal && (
        <div className="modal-backdrop" onClick={() => setActivePhotoModal(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setActivePhotoModal(null)}>
              <X size={24} />
            </button>
            <img
              src={activePhotoModal.url_anh_hoan_thien || activePhotoModal.url_anh_tho}
              alt="High resolution preview"
              className="lightbox-img"
            />
          </div>
        </div>
      )}
    </div>
  );
}
