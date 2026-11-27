import React, { useState } from 'react';
import { X, Calendar, Shirt, DoorOpen, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ConceptModal({ concept, onClose, onBookNow }) {
  if (!concept) return null;

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const photoList = concept.danh_sach_hinh_mau && concept.danh_sach_hinh_mau.length > 0
    ? concept.danh_sach_hinh_mau
    : [concept.hinh_dai_dien];

  const handlePrev = () => {
    setActivePhotoIdx((prev) => (prev === 0 ? photoList.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setActivePhotoIdx((prev) => (prev === photoList.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content modal-content-lg concept-detail-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose} aria-label="Đóng">
          <X size={20} />
        </button>

        <div className="concept-modal-body">
          {/* Gallery Carousel */}
          <div className="concept-modal-gallery">
            <div className="main-image-container">
              <img
                src={photoList[activePhotoIdx]}
                alt={concept.ten_concept}
                className="main-image"
              />
              {photoList.length > 1 && (
                <>
                  <button className="gallery-nav-btn prev" onClick={handlePrev}>
                    <ChevronLeft size={20} />
                  </button>
                  <button className="gallery-nav-btn next" onClick={handleNext}>
                    <ChevronRight size={20} />
                  </button>
                  <div className="gallery-counter">
                    {activePhotoIdx + 1} / {photoList.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnail list */}
            {photoList.length > 1 && (
              <div className="thumbnail-list">
                {photoList.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    className={`thumb-btn ${idx === activePhotoIdx ? 'active' : ''}`}
                    onClick={() => setActivePhotoIdx(idx)}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details info */}
          <div className="concept-modal-info">
            <div className="badge badge-gold" style={{ marginBottom: '10px' }}>
              <Sparkles size={14} /> {concept.danh_muc_dich_vu?.ten_danh_muc || 'Concept Nghệ Thuật'}
            </div>

            <h2 className="concept-title font-serif">{concept.ten_concept}</h2>
            <p className="concept-desc">{concept.mo_ta}</p>

            <div className="concept-feature-list">
              {concept.phong_chup && (
                <div className="concept-feature-item">
                  <div className="feature-icon">
                    <DoorOpen size={18} />
                  </div>
                  <div>
                    <div className="feature-label">Không Gian / Phòng Chụp</div>
                    <div className="feature-value">{concept.phong_chup.ten_phong}</div>
                    <div className="feature-sub">{concept.phong_chup.phong_cach}</div>
                  </div>
                </div>
              )}

              {concept.goi_y_trang_phuc && (
                <div className="concept-feature-item">
                  <div className="feature-icon">
                    <Shirt size={18} />
                  </div>
                  <div>
                    <div className="feature-label">Gợi Ý Phối Trang Phục (Outfit)</div>
                    <div className="feature-value">{concept.goi_y_trang_phuc}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="concept-modal-actions">
              <button
                className="btn-primary btn-block"
                onClick={() => {
                  onClose();
                  onBookNow(concept);
                }}
              >
                <Calendar size={18} /> Đặt Lịch Chụp Concept Này
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
