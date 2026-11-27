import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/client';
import {
  Calendar,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Camera,
  Layers,
  Heart,
  Star,
  CheckCircle2,
  Clock,
  ChevronRight,
  Maximize2,
} from 'lucide-react';

export default function HomeView({ setActiveView, onSelectConcept, onOpenConceptDetail }) {
  const [homeData, setHomeData] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================================================================
  // 🎓 TẢI DỮ LIỆU TỔNG HỢP CHO TRANG CHỦ (HOME CATALOG)
  // - "Tại sao trang chủ chỉ gọi 1 API duy nhất?":
  //    Thay vì gửi nhiều request lẻ tẻ, Backend cung cấp endpoint GET /api/catalog/home
  //    trả về cùng lúc 4 khối dữ liệu:
  //    1. danh_muc: Các thể loại dịch vụ chụp
  //    2. concepts_noi_bat: Tối đa 8 concept tiêu biểu nhất
  //    3. goi_dich_vu: 3 gói dịch vụ cơ bản (Basic, Standard, VIP)
  //    4. phong_chup: 3 phòng chụp vật lý thực tế của Studio
  // =========================================================================
  useEffect(() => {
    async function fetchHome() {
      try {
        const res = await catalogApi.getHome();
        if (res.success && res.data) {
          setHomeData(res.data);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu trang chủ:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHome();
  }, []);

  return (
    <div className="home-page">
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-glow-bg"></div>
        <div className="container hero-container">
          <div className="hero-content">
            <div className="badge badge-gold hero-badge">
              <Sparkles size={14} /> Không Gian Nghệ Thuật Nhiếp Ảnh Chuyên Nghiệp
            </div>
            <h1 className="hero-title font-serif">
              Lưu Giữ Khoảnh Khắc <br />
              <span className="hero-highlight">Tôn Vinh Vẻ Đẹp</span> Của Bạn
            </h1>
            <p className="hero-subtitle">
              Hệ thống đặt lịch studio thông minh: Tra cứu concept, chọn khung giờ còn trống trong ngày và thanh toán cọc trực tuyến tiện lợi chỉ trong 2 phút.
            </p>

            <div className="hero-actions">
              <button
                className="btn-primary"
                onClick={() => setActiveView('booking')}
              >
                <Calendar size={18} /> Đặt Lịch Chụp Ngay
              </button>
              <button
                className="btn-secondary"
                onClick={() => setActiveView('concepts')}
              >
                <Camera size={18} /> Khám Phá Bộ Sưu Tập <ArrowRight size={16} />
              </button>
            </div>

            {/* Stats bar */}
            <div className="hero-stats">
              <div className="stat-item">
                <span className="stat-num">5000+</span>
                <span className="stat-text">Khách hàng tin chọn</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">50+</span>
                <span className="stat-text">Concept nghệ thuật</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">03</span>
                <span className="stat-text">Phòng chụp đa phong cách</span>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <span className="stat-num">4.9 ★</span>
                <span className="stat-text">Đánh giá xuất sắc</span>
              </div>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card-stack">
              <div className="hero-card hero-card-main">
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80"
                  alt="Portrait Photography"
                />
                <div className="hero-card-overlay">
                  <div className="hero-card-tag">Concept Nổi Bật</div>
                  <div className="hero-card-title">Chân Dung Nghệ Thuật</div>
                </div>
              </div>
              <div className="hero-floating-badge badge-top-right">
                <Star size={16} fill="var(--gold-primary)" color="var(--gold-primary)" />
                <span>Thiết bị chuẩn Quốc Tế</span>
              </div>
              <div className="hero-floating-badge badge-bottom-left">
                <ShieldCheck size={16} color="var(--emerald-success)" />
                <span>Giữ slot 100% thời gian thực</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. CATEGORIES SHOWCASE */}
      <section className="section-padding">
        <div className="container">
          <div className="section-header text-center">
            <div className="badge badge-gold">Danh Mục Dịch Vụ</div>
            <h2 className="section-title font-serif">Chọn Phong Cách Của Bạn</h2>
            <p className="section-subtitle">
              Đa dạng các phong cách chụp ảnh từ nàng thơ, cá nhân, cặp đôi đến profile doanh nghiệp chuyên nghiệp.
            </p>
          </div>

          <div className="categories-grid">
            {loading ? (
              <div className="loading-placeholder">Đang tải danh mục...</div>
            ) : (
              homeData?.danh_muc?.map((cat) => (
                <div
                  key={cat.id}
                  className="category-card"
                  onClick={() => setActiveView('concepts')}
                >
                  <img src={cat.hinh_dai_dien} alt={cat.ten_danh_muc} className="category-img" />
                  <div className="category-overlay">
                    <div className="category-count">{cat.so_luong_concept || 0} Concept</div>
                    <h3 className="category-title font-serif">{cat.ten_danh_muc}</h3>
                    <p className="category-desc">{cat.mo_ta}</p>
                    <span className="category-link">
                      Xem concept <ChevronRight size={16} />
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 3. FEATURED CONCEPTS */}
      <section className="section-padding bg-surface-section">
        <div className="container">
          <div className="section-header-flex">
            <div>
              <div className="badge badge-gold">Bộ Sưu Tập Nổi Bật</div>
              <h2 className="section-title font-serif">Concept Được Yêu Thích Nhất</h2>
              <p className="section-subtitle">Những ý tưởng bối cảnh độc quyền chỉ có tại Bơ Photo Studio</p>
            </div>
            <button className="btn-secondary" onClick={() => setActiveView('concepts')}>
              Xem Tất Cả Concept <ArrowRight size={16} />
            </button>
          </div>

          <div className="concepts-grid">
            {loading ? (
              <div className="loading-placeholder">Đang tải concept...</div>
            ) : (
              homeData?.concepts_noi_bat?.map((concept) => (
                <div key={concept.id} className="concept-card">
                  <div className="concept-img-wrapper">
                    <img src={concept.hinh_dai_dien} alt={concept.ten_concept} className="concept-img" />
                    <div className="concept-overlay-actions">
                      <button
                        className="btn-icon-blur"
                        title="Xem phóng to ảnh"
                        onClick={() => onOpenConceptDetail(concept)}
                      >
                        <Maximize2 size={18} />
                      </button>
                      <button
                        className="btn-primary btn-sm"
                        onClick={() => onSelectConcept(concept)}
                      >
                        <Calendar size={14} /> Đặt Lịch
                      </button>
                    </div>
                    {concept.phong_chup && (
                      <div className="concept-room-tag">
                        {concept.phong_chup.ten_phong.split(' - ')[0]}
                      </div>
                    )}
                  </div>
                  <div className="concept-info">
                    <div className="concept-category-badge">
                      {concept.danh_muc_dich_vu?.ten_danh_muc || 'Concept Nghệ Thuật'}
                    </div>
                    <h3 className="concept-title font-serif" onClick={() => onOpenConceptDetail(concept)}>
                      {concept.ten_concept}
                    </h3>
                    <p className="concept-summary">{concept.mo_ta}</p>
                    {concept.goi_y_trang_phuc && (
                      <div className="concept-outfit">
                        <span>Trang phục:</span> {concept.goi_y_trang_phuc}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* 4. PRICING PACKAGES OVERVIEW */}
      <section className="section-padding">
        <div className="container">
          <div className="section-header text-center">
            <div className="badge badge-gold">Bảng Giá Minh Bạch</div>
            <h2 className="section-title font-serif">Các Gói Dịch Vụ Tiêu Chuẩn</h2>
            <p className="section-subtitle">
              Lựa chọn quy mô gói phù hợp với nhu cầu. Đặt cọc 30% giữ chỗ, 70% còn lại thanh toán sau buổi chụp.
            </p>
          </div>

          <div className="packages-grid">
            {homeData?.goi_dich_vu?.map((pkg, idx) => {
              const isPopular = pkg.ma_goi === 'standard';
              return (
                <div
                  key={pkg.id}
                  className={`package-card ${isPopular ? 'package-card-popular' : ''}`}
                >
                  {isPopular && <div className="popular-badge">Được Yêu Thích Nhất</div>}

                  <div className="package-header">
                    <h3 className="package-name font-serif">{pkg.ten_goi}</h3>
                    <p className="package-desc">{pkg.mo_ta}</p>
                    <div className="package-price">
                      <span className="price-num">
                        {new Intl.NumberFormat('vi-VN').format(pkg.gia_co_ban)}
                      </span>
                      <span className="price-unit">VNĐ</span>
                    </div>
                  </div>

                  <div className="package-features">
                    <div className="package-feature-item">
                      <CheckCircle2 size={16} className="feature-check" />
                      <span>Thời lượng chụp: <strong>{pkg.thoi_luong_phut} phút</strong></span>
                    </div>
                    <div className="package-feature-item">
                      <CheckCircle2 size={16} className="feature-check" />
                      <span>Số ảnh chỉnh sửa photoshop: <strong>{pkg.so_anh_chinh_sua} ảnh</strong></span>
                    </div>
                    <div className="package-feature-item">
                      <CheckCircle2 size={16} className="feature-check" />
                      <span>Tối đa: <strong>{pkg.so_trang_phuc_toi_da} bộ trang phục</strong></span>
                    </div>
                    <div className="package-feature-item">
                      <CheckCircle2 size={16} className="feature-check" />
                      <span>Hỗ trợ thiết bị ánh sáng studio cao cấp</span>
                    </div>
                    <div className="package-feature-item">
                      <CheckCircle2 size={16} className="feature-check" />
                      <span>Cổng chọn ảnh trực tuyến tại nhà</span>
                    </div>
                  </div>

                  <button
                    className={`btn-block ${isPopular ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveView('booking')}
                  >
                    Chọn Gói Này
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. STUDIO SPACES / ROOMS */}
      <section className="section-padding bg-surface-section">
        <div className="container">
          <div className="section-header text-center">
            <div className="badge badge-gold">Không Gian Studio</div>
            <h2 className="section-title font-serif">03 Phòng Chụp Chuyên Biệt</h2>
            <p className="section-subtitle">Mỗi phòng chụp được setup với ánh sáng, phông nền và đạo cụ độc đáo</p>
          </div>

          <div className="rooms-grid">
            {homeData?.phong_chup?.map((room) => (
              <div key={room.id} className="room-card">
                <div className="room-header">
                  <div className="room-number">ROOM {room.id}</div>
                  <h3 className="room-name font-serif">{room.ten_phong}</h3>
                  <div className="room-style-badge">{room.phong_cach}</div>
                </div>
                <p className="room-desc">{room.mo_ta}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. 4-STEP BOOKING WORKFLOW */}
      <section className="section-padding">
        <div className="container">
          <div className="section-header text-center">
            <div className="badge badge-gold">Quy Trình Chuyên Nghiệp</div>
            <h2 className="section-title font-serif">Đặt Lịch & Nhận Ảnh Dễ Dàng</h2>
            <p className="section-subtitle">Trải nghiệm dịch vụ nhanh chóng, minh bạch và hoàn toàn trực tuyến</p>
          </div>

          <div className="steps-container">
            <div className="step-card">
              <div className="step-number">01</div>
              <h4>Chọn Concept & Gói</h4>
              <p>Khám phá bộ sưu tập mẫu ảnh, chọn gói chụp và các dịch vụ makeup, thêm người phù hợp.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">02</div>
              <h4>Chọn Ca Chụp Trực Tuyến</h4>
              <p>Hệ thống hiển thị thời gian thực các khung giờ còn trống trong ngày và giữ slot cho bạn.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">03</div>
              <h4>Đặt Cọc 30% Tiện Lợi</h4>
              <p>Quét mã VietQR chuyển khoản nhanh chóng. Xác nhận đơn và giữ chỗ tức thì.</p>
            </div>
            <div className="step-arrow">→</div>
            <div className="step-card">
              <div className="step-number">04</div>
              <h4>Duyệt Ảnh Tại Nhà</h4>
              <p>Xem ảnh thô, tick chọn ảnh cần chỉnh sửa kèm ghi chú photoshop và tải ảnh hoàn thiện.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. CTA BANNER */}
      <section className="cta-banner-section">
        <div className="container">
          <div className="cta-banner">
            <div className="cta-banner-content">
              <h2 className="font-serif">Sẵn Sàng Cho Bộ Ảnh Của Riêng Bạn?</h2>
              <p>Đặt lịch ngay hôm nay để nhận ưu đãi đặc biệt và chọn được khung giờ chụp ưng ý nhất.</p>
              <button
                className="btn-primary"
                onClick={() => setActiveView('booking')}
              >
                <Calendar size={18} /> Đặt Lịch Chụp Ngay Hôm Nay
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
