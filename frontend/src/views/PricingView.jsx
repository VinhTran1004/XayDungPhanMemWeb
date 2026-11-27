import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/client';
import { CheckCircle2, Plus, Sparkles, ShieldCheck, RefreshCw, Calendar } from 'lucide-react';

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
      <div className="packages-grid" style={{ marginBottom: '64px' }}>
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

      {/* ADDONS TABLE */}
      <div className="addons-section">
        <div className="section-header text-center">
          <div className="badge badge-gold">Dịch Vụ Cộng Thêm</div>
          <h2 className="section-title font-serif">Dịch Vụ & Phụ Phí Tùy Chọn</h2>
          <p className="section-subtitle">Tùy biến buổi chụp hoàn hảo theo đúng mong muốn của bạn</p>
        </div>

        <div className="addons-grid">
          {addons.map((addon) => (
            <div key={addon.id} className="addon-card">
              <div className="addon-info">
                <h4>{addon.ten_dich_vu}</h4>
                <p>{addon.mo_ta}</p>
              </div>
              <div className="addon-price-col">
                <div className="addon-price">
                  +{new Intl.NumberFormat('vi-VN').format(addon.gia)} đ
                </div>
                <div className="addon-unit">/ {addon.don_vi_tinh}</div>
              </div>
            </div>
          ))}
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
