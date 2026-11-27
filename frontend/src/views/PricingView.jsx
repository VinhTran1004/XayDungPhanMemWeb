import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/client';
import {
  CheckCircle2,
  Plus,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Calendar,
  Users,
  Camera,
  BookOpen,
  Layers,
  Palette,
  Gem,
  Clock,
  CloudLightning,
} from 'lucide-react';

export default function PricingView({ setActiveView }) {
  const [packages, setPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPricing() {
      try {
        const [pkgRes, addonRes] = await Promise.all([
          catalogApi.getPackages(),
          catalogApi.getAddons(),
        ]);
        if (pkgRes.success) setPackages(Array.isArray(pkgRes.data) ? pkgRes.data : []);
        if (addonRes.success) setAddons(Array.isArray(addonRes.data) ? addonRes.data : []);
      } catch (err) {
        console.error('Lỗi tải bảng giá:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPricing();
  }, []);

  const getAddonMeta = (addon) => {
    const name = (addon.ten_dich_vu || '').toLowerCase();
    if (name.includes('makeup') || name.includes('trang điểm')) {
      return {
        icon: <Palette size={26} />,
        badge: 'Khuyên Dùng',
        highlight: 'Mỹ phẩm high-end MAC & Dior chính hãng',
        category: 'Trang Điểm & Làm Tóc',
      };
    }
    if (name.includes('người') || name.includes('thêm')) {
      return {
        icon: <Users size={26} />,
        badge: 'Phổ Biến',
        highlight: 'Thêm phụ kiện & tối đa 8 người/ca chụp',
        category: 'Khách Chụp Kèm',
      };
    }
    if (name.includes('gốc') || name.includes('raw') || name.includes('toàn bộ')) {
      return {
        icon: <Camera size={26} />,
        badge: 'Bản Quyền',
        highlight: 'Bàn giao file JPEG gốc 4K chất lượng cao',
        category: 'Dữ Liệu Ảnh Gốc',
      };
    }
    if (name.includes('photobook') || name.includes('album') || name.includes('in')) {
      return {
        icon: <BookOpen size={26} />,
        badge: 'Cao Cấp',
        highlight: 'Giấy mỹ thuật chống ẩm & tráng gương sang trọng',
        category: 'In Ấn Kỷ Niệm',
      };
    }
    return {
      icon: <Layers size={26} />,
      badge: 'Chuyên Sâu',
      highlight: 'Chỉnh da, thon dáng & màu sắc chuẩn tạp chí',
      category: 'Hậu Kỳ Photoshop',
    };
  };

  return (
    <div className="container section-padding">
      <div className="section-header text-center">
        <div className="badge badge-gold">Bảng Giá Dịch Vụ 2026</div>
        <h1 className="section-title font-serif">Bảng Giá Gói Chụp & Phụ Phí</h1>
        <p className="section-subtitle">
          Minh bạch quyền lợi - Không phát sinh chi phí ẩn. Hỗ trợ đặt cọc trực tuyến 30% giữ slot.
        </p>
      </div>

      {/* 3 PACKAGES GRID */}
      <div className="packages-grid" style={{ marginBottom: '72px' }}>
        {packages.map((pkg) => {
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
                  <span>Thời lượng ca chụp: <strong>{pkg.thoi_luong_phut} phút</strong></span>
                </div>
                <div className="package-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <span>Ảnh chỉnh sửa photoshop: <strong>{pkg.so_anh_chinh_sua} ảnh</strong></span>
                </div>
                <div className="package-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <span>Đổi tối đa: <strong>{pkg.so_trang_phuc_toi_da} bộ trang phục</strong></span>
                </div>
                <div className="package-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <span>Setup ánh sáng theo concept</span>
                </div>
                <div className="package-feature-item">
                  <CheckCircle2 size={16} className="feature-check" />
                  <span>Duyệt ảnh online tại nhà</span>
                </div>
                {pkg.ma_goi === 'vip' && (
                  <div className="package-feature-item" style={{ color: 'var(--gold-primary)' }}>
                    <Sparkles size={16} className="feature-check" />
                    <span><strong>Tặng kèm 01 ảnh gỗ để bàn tráng gương</strong></span>
                  </div>
                )}
              </div>

              <button
                className={`btn-block ${isPopular ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveView('booking')}
              >
                <Calendar size={16} /> Đặt Gói Này
              </button>
            </div>
          );
        })}
      </div>

      {/* ADDONS REDESIGN */}
      <div className="addons-section" style={{ marginBottom: '72px' }}>
        <div className="section-header text-center">
          <div className="badge badge-gold">Tùy Biến Theo Nhu Cầu</div>
          <h2 className="section-title font-serif">Dịch Vụ Cộng Thêm & Phụ Phí</h2>
          <p className="section-subtitle">
            Lựa chọn bổ sung linh hoạt để buổi chụp thêm trọn vẹn và hoàn hảo đúng mong muốn của bạn
          </p>
        </div>

        <div className="addons-luxury-grid">
          {addons.map((addon) => {
            const meta = getAddonMeta(addon);
            return (
              <div key={addon.id} className="addon-luxury-card">
                <div className="addon-card-top">
                  <div className="addon-card-icon">{meta.icon}</div>
                  <div className="addon-card-badges">
                    <span className="addon-cat-tag">{meta.category}</span>
                    <span className="badge badge-gold">{meta.badge}</span>
                  </div>
                </div>

                <div className="addon-card-body">
                  <h3 className="addon-title font-serif">{addon.ten_dich_vu}</h3>
                  <p className="addon-desc">{addon.mo_ta}</p>
                  <div className="addon-feature-chip">
                    <CheckCircle2 size={14} /> {meta.highlight}
                  </div>
                </div>

                <div className="addon-card-bottom">
                  <div className="addon-pricing-tag">
                    <div className="addon-pricing-val">
                      +{new Intl.NumberFormat('vi-VN').format(addon.gia)} <span className="addon-currency">VNĐ</span>
                    </div>
                    <div className="addon-pricing-unit">/ {addon.don_vi_tinh}</div>
                  </div>

                  <button
                    className="btn-outline-gold btn-sm addon-cta-btn"
                    onClick={() => setActiveView('booking')}
                  >
                    <Plus size={14} /> Đặt Kèm Khi Tạo Đơn
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Studio Privileges Banner */}
        <div className="studio-privileges-banner">
          <div className="privilege-box">
            <div className="privilege-icon">
              <Gem size={24} />
            </div>
            <div className="privilege-text">
              <h4>100% Mỹ Phẩm Chính Hãng</h4>
              <p>Mỹ phẩm MAC, NARS, Dior an toàn và phù hợp mọi làn da</p>
            </div>
          </div>

          <div className="privilege-box">
            <div className="privilege-icon">
              <Camera size={24} />
            </div>
            <div className="privilege-text">
              <h4>Thiết Bị Chụp Chuyên Nghiệp</h4>
              <p>Máy ảnh Sony Alpha Master & Dàn đèn Godox / Profoto chuẩn studio</p>
            </div>
          </div>

          <div className="privilege-box">
            <div className="privilege-icon">
              <CloudLightning size={24} />
            </div>
            <div className="privilege-text">
              <h4>Lưu Trữ Cloud Riêng Tư 12 Tháng</h4>
              <p>Duyệt ảnh online tại nhà và tải ảnh gốc tốc độ cao bất cứ lúc nào</p>
            </div>
          </div>

          <div className="privilege-box">
            <div className="privilege-icon">
              <Clock size={24} />
            </div>
            <div className="privilege-text">
              <h4>Bàn Giao Đúng Hạn</h4>
              <p>Ảnh duyệt sau 24 giờ - Trả ảnh Photoshop hoàn thiện sau 3 - 5 ngày</p>
            </div>
          </div>
        </div>
      </div>

      {/* POLICIES */}
      <div className="policy-box">
        <h3 className="font-serif" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color="var(--gold-primary)" /> Chính Sách Đổi & Hủy Lịch Đặt Studio
        </h3>
        <div className="policy-grid">
          <div className="policy-item">
            <h4>1. Chính sách Đổi Lịch (Reschedule)</h4>
            <p>
              Khách hàng được hỗ trợ <strong>đổi lịch chụp miễn phí 01 lần</strong> khi thực hiện thông báo trước giờ chụp tối thiểu <strong>24 giờ</strong> (tùy thuộc vào khung giờ còn trống của phòng chụp).
            </p>
          </div>
          <div className="policy-item">
            <h4>2. Chính sách Hủy Lịch Trước 48h</h4>
            <p>
              Khi hủy lịch trước giờ chụp từ <strong>48 giờ trở lên</strong>: Khách hàng được lựa chọn nhận <strong>Voucher bảo lưu 100% tiền cọc</strong> (hạn dùng 6 tháng) hoặc hoàn lại <strong>50% tiền cọc</strong> qua tài khoản ngân hàng.
            </p>
          </div>
          <div className="policy-item">
            <h4>3. Hủy Lịch Dưới 48h</h4>
            <p>
              Do chi phí chuẩn bị bối cảnh và thợ chụp đã được chốt, các đơn hủy trong vòng <strong>dưới 48 giờ</strong> sẽ không được hoàn cọc theo quy định.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
