import React, { useState, useEffect } from 'react';
import { catalogApi, bookingApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Calendar,
  Clock,
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  ArrowRight,
  ArrowLeft,
  QrCode,
  Tag,
  ShieldCheck,
  User,
  Phone,
  Mail,
  FileText,
} from 'lucide-react';

export default function BookingView({
  initialConcept,
  setActiveView,
  onBookingSuccess,
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [step, setStep] = useState(1); // 1: Concept & Package -> 2: Date & Slot -> 3: Customer Info -> 4: Payment
  const [loading, setLoading] = useState(false);

  // Master catalog data
  const [concepts, setConcepts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [addons, setAddons] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);

  // Selections
  const [selectedConcept, setSelectedConcept] = useState(initialConcept || null);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedAddons, setSelectedAddons] = useState({}); // { [addonId]: quantity }

  // Date & Slot
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [ngayChup, setNgayChup] = useState(tomorrowStr);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availabilityList, setAvailabilityList] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  // Customer info & Voucher
  const [customerInfo, setCustomerInfo] = useState({
    ho_ten: user?.ho_ten || '',
    so_dien_thoai: user?.so_dien_thoai || '',
    email: user?.email || '',
    ghi_chu_khach_hang: '',
  });
  const [voucherCode, setVoucherCode] = useState('');
  const [voucherDiscount, setVoucherDiscount] = useState(0);

  // Price calculation
  const [pricingSummary, setPricingSummary] = useState({
    gia_goi: 0,
    tong_tien_dich_vu_them: 0,
    tien_giam_voucher: 0,
    tong_tien: 0,
    tien_coc: 0,
    tien_con_lai: 0,
  });

  // Created booking & Payment
  const [createdBooking, setCreatedBooking] = useState(null);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [isDepositPaid, setIsDepositPaid] = useState(false);

  // =========================================================================
  // 🎓 BƯỚC 1: TẢI DỮ LIỆU BAN ĐẦU (CONCEPTS, GÓI, DỊCH VỤ THÊM, KHUNG GIỜ)
  // - "Tại sao dùng Promise.all?": Để gửi 4 API cùng lúc song song, giúp trang tải
  //   nhanh gấp 4 lần thay vì phải chờ từng request hoàn thành tuần tự.
  // - APIs gọi: /catalog/concepts, /catalog/packages, /catalog/addons, /catalog/time-slots
  // =========================================================================
  useEffect(() => {
    async function loadCatalog() {
      try {
        const [conceptsRes, pkgsRes, addonsRes, slotsRes] = await Promise.all([
          catalogApi.getConcepts(),
          catalogApi.getPackages(),
          catalogApi.getAddons(),
          catalogApi.getTimeSlots(),
        ]);

        if (conceptsRes.success) setConcepts(conceptsRes.data);
        if (pkgsRes.success) {
          setPackages(pkgsRes.data);
          // Mặc định chọn gói Tiêu Chuẩn (Standard) vì là gói phổ biến nhất
          const standardPkg = pkgsRes.data.find((p) => p.ma_goi === 'standard') || pkgsRes.data[0];
          setSelectedPackage(standardPkg);
        }
        if (addonsRes.success) setAddons(addonsRes.data);
        if (slotsRes.success) setTimeSlots(slotsRes.data);

        // Nếu chưa chọn concept từ trang ngoài thì mặc định lấy concept đầu tiên
        if (!initialConcept && conceptsRes.success && conceptsRes.data.length > 0) {
          setSelectedConcept(conceptsRes.data[0]);
        }
      } catch (err) {
        console.error('Lỗi tải dữ liệu đặt lịch:', err);
      }
    }
    loadCatalog();
  }, [initialConcept]);

  // Đồng bộ thông tin nếu khách hàng đã đăng nhập
  useEffect(() => {
    if (user) {
      setCustomerInfo((prev) => ({
        ...prev,
        ho_ten: user.ho_ten || prev.ho_ten,
        so_dien_thoai: user.so_dien_thoai || prev.so_dien_thoai,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  // =========================================================================
  // 🎓 BƯỚC 2: KIỂM TRA TRÙNG LỊCH THỜI GIAN THỰC (REAL-TIME AVAILABILITY)
  // - "API nào kiểm tra ca trống?": GET /api/bookings/availability?ngay_chup=...&concept_id=...
  // - "Thuật toán Backend kiểm tra gì?":
  //    1. Phòng chụp của Concept đã có ai đặt giờ đó chưa? (Tối đa 1 ca/phòng)
  //    2. Giờ đó Studio còn ít nhất 1 thợ rảnh hay không?
  // - Nhận về: Mảng 6 ca chụp kèm 'kha_dung: true/false' và 'ly_do_het_cho'.
  // =========================================================================
  useEffect(() => {
    async function checkSlots() {
      if (!selectedConcept || !ngayChup) return;
      setLoadingAvailability(true);
      try {
        const res = await bookingApi.checkAvailability(ngayChup, selectedConcept.id);
        if (res.success && res.data) {
          setAvailabilityList(res.data);
        }
      } catch (err) {
        console.warn('Lỗi kiểm tra ca trống:', err.message);
      } finally {
        setLoadingAvailability(false);
      }
    }

    if (step >= 2) {
      checkSlots();
    }
  }, [ngayChup, selectedConcept, step]);

  // =========================================================================
  // 🎓 BƯỚC 3: TÍNH TOÁN BẢNG GIÁ VÀ TIỀN CỌC 30% (PRICING ENGINE)
  // - API gọi: POST /api/bookings/calculate-price
  // - Gửi lên: { goi_dich_vu_id, dich_vu_them, ma_voucher }
  // - Nhận về: Tổng tiền chi tiết, tính sẵn tiền cọc 30% và tiền còn lại 70%.
  // =========================================================================
  useEffect(() => {
    async function calcPrice() {
      if (!selectedPackage) return;

      const formattedAddons = Object.entries(selectedAddons)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({
          dich_vu_cong_them_id: Number(id),
          so_luong: qty,
        }));

      try {
        const res = await bookingApi.calculatePrice({
          goi_dich_vu_id: selectedPackage.id,
          dich_vu_them: formattedAddons,
          ma_voucher: voucherCode || undefined,
        });

        if (res.success && res.data) {
          setPricingSummary(res.data);
          setVoucherDiscount(res.data.tien_giam_voucher || 0);
        }
      } catch {
        // Fallback tự tính toán nếu mất mạng
        const basePrice = selectedPackage.gia_co_ban || 0;
        let addonsTotal = 0;
        addons.forEach((a) => {
          if (selectedAddons[a.id]) {
            addonsTotal += a.gia * selectedAddons[a.id];
          }
        });
        const total = basePrice + addonsTotal - voucherDiscount;
        const deposit = Math.round(total * 0.3);
        setPricingSummary({
          gia_goi: basePrice,
          tong_tien_dich_vu_them: addonsTotal,
          tien_giam_voucher: voucherDiscount,
          tong_tien: total,
          tien_coc: deposit,
          tien_con_lai: total - deposit,
        });
      }
    }

    calcPrice();
  }, [selectedPackage, selectedAddons, voucherCode, voucherDiscount, addons]);

  // Addon quantity toggle
  const handleAddonQty = (addonId, delta) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[addonId];
        return copy;
      }
      return { ...prev, [addonId]: next };
    });
  };

  // Apply Voucher
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      showToast('Vui lòng nhập mã voucher', 'warning');
      return;
    }
    setLoading(true);
    try {
      const formattedAddons = Object.entries(selectedAddons)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({
          dich_vu_cong_them_id: Number(id),
          so_luong: qty,
        }));

      const res = await bookingApi.calculatePrice({
        goi_dich_vu_id: selectedPackage.id,
        dich_vu_them: formattedAddons,
        ma_voucher: voucherCode.trim(),
      });

      if (res.success && res.data) {
        if (res.data.tien_giam_voucher > 0) {
          showToast(`Áp dụng thành công! Giảm ${new Intl.NumberFormat('vi-VN').format(res.data.tien_giam_voucher)} đ`, 'success');
          setPricingSummary(res.data);
          setVoucherDiscount(res.data.tien_giam_voucher);
        } else {
          showToast('Mã voucher hợp lệ nhưng không áp dụng được giảm giá cho đơn này', 'info');
        }
      }
    } catch (err) {
      showToast(err.message || 'Mã voucher không hợp lệ hoặc đã hết hạn', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 🎓 BƯỚC 4: GỬI LỆNH TẠO ĐƠN ĐẶT LỊCH LÊN BACKEND
  // - API gọi: POST /api/bookings
  // - Body gửi lên: { concept_id, goi_dich_vu_id, khung_gio_id, ngay_chup, dich_vu_them, ma_voucher, ghi_chu }
  // - Kết quả Backend trả về:
  //    1. 'don_dat_lich': Mã đơn (VD: BK-202611-ABC), trạng thái 'cho_thanh_toan_coc'
  //    2. 'thong_tin_chuyen_khoan': STK ngân hàng, số tiền cọc 30%, mã QR và hạn giữ slot 15 phút.
  // =========================================================================
  const handleCreateBooking = async () => {
    if (!user) {
      showToast('Vui lòng đăng nhập để hệ thống lưu đơn đặt lịch vào tài khoản của bạn', 'info');
      openAuthModal('login');
      return;
    }

    if (!selectedConcept || !selectedPackage || !selectedSlot || !ngayChup) {
      showToast('Vui lòng chọn đầy đủ Concept, Gói chụp, Ngày và Khung giờ chụp', 'warning');
      return;
    }

    setLoading(true);
    try {
      const formattedAddons = Object.entries(selectedAddons)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => ({
          dich_vu_cong_them_id: Number(id),
          so_luong: qty,
        }));

      const payload = {
        concept_id: selectedConcept.id,
        goi_dich_vu_id: selectedPackage.id,
        khung_gio_id: selectedSlot.khung_gio_id || selectedSlot.id,
        ngay_chup: ngayChup,
        dich_vu_them: formattedAddons,
        ma_voucher: voucherCode.trim() || undefined,
        ghi_chu_khach_hang: customerInfo.ghi_chu_khach_hang || undefined,
      };

      const res = await bookingApi.createBooking(payload);

      if (res.success && res.data) {
        setCreatedBooking(res.data.don_dat_lich);
        setPaymentInfo(res.data.thong_tin_chuyen_khoan);
        showToast('Tạo đơn đặt lịch thành công! Vui lòng đặt cọc 30% để giữ chỗ.', 'success');
        setStep(4);
      }
    } catch (err) {
      showToast(err.message || 'Không thể tạo đơn đặt lịch. Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // =========================================================================
  // 🎓 BƯỚC 5: XÁC NHẬN ĐÃ CHUYỂN KHOẢN ĐẶT CỌC 30%
  // - API gọi: POST /api/bookings/:id/pay-deposit
  // - Khi khách bấm xác nhận chuyển khoản xong, đơn được chuyển từ 'cho_thanh_toan_coc' -> 'da_coc'
  // =========================================================================
  const handleConfirmDeposit = async () => {
    if (!createdBooking) return;
    setLoading(true);
    try {
      const res = await bookingApi.payDeposit(createdBooking.id, {
        hinh_thuc: 'chuyen_khoan',
        ma_giao_dich: `TXN_${Date.now()}`,
      });

      if (res.success) {
        setIsDepositPaid(true);
        showToast('Xác nhận đặt cọc 30% thành công! Chúc bạn có buổi chụp ảnh tuyệt vời.', 'success');
      }
    } catch (err) {
      showToast(err.message || 'Lỗi xác nhận thanh toán cọc', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper copy text
  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, 'info');
  };

  return (
    <div className="container section-padding booking-page">
      <div className="section-header text-center">
        <div className="badge badge-gold">Quy Trình Đặt Lịch Chuẩn Studio</div>
        <h1 className="section-title font-serif">Đặt Lịch Chụp Ảnh Trực Tuyến</h1>
        <p className="section-subtitle">
          Chủ động chọn ngày, khung giờ còn trống và thanh toán cọc nhanh chóng qua mã VietQR
        </p>
      </div>

      {/* PROGRESS STEP BAR */}
      <div className="booking-stepper">
        <div className={`step-node ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 1 ? <Check size={16} /> : '1'}</div>
          <div className="step-label">Concept & Gói</div>
        </div>
        <div className={`step-line ${step >= 2 ? 'active' : ''}`}></div>
        <div className={`step-node ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 2 ? <Check size={16} /> : '2'}</div>
          <div className="step-label">Ngày & Ca Chụp</div>
        </div>
        <div className={`step-line ${step >= 3 ? 'active' : ''}`}></div>
        <div className={`step-node ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <div className="step-circle">{step > 3 ? <Check size={16} /> : '3'}</div>
          <div className="step-label">Thông Tin & Voucher</div>
        </div>
        <div className={`step-line ${step >= 4 ? 'active' : ''}`}></div>
        <div className={`step-node ${step >= 4 ? 'active' : ''}`}>
          <div className="step-circle">4</div>
          <div className="step-label">Đặt Cọc 30%</div>
        </div>
      </div>

      {/* STEP 1: CHỌN CONCEPT & GÓI & PHỤ PHÍ */}
      {step === 1 && (
        <div className="booking-step-content">
          <div className="step-section">
            <h3 className="step-heading font-serif">
              <Sparkles size={20} color="var(--gold-primary)" /> Bước 1.1: Chọn Concept Chụp
            </h3>
            <div className="booking-concepts-grid">
              {concepts.map((concept) => (
                <div
                  key={concept.id}
                  className={`concept-select-card ${selectedConcept?.id === concept.id ? 'selected' : ''}`}
                  onClick={() => setSelectedConcept(concept)}
                >
                  <img src={concept.hinh_dai_dien} alt={concept.ten_concept} />
                  <div className="select-card-info">
                    <div className="select-card-badge">{concept.danh_muc_dich_vu?.ten_danh_muc}</div>
                    <h4>{concept.ten_concept}</h4>
                    {concept.phong_chup && <p>{concept.phong_chup.ten_phong.split(' - ')[0]}</p>}
                  </div>
                  {selectedConcept?.id === concept.id && (
                    <div className="selected-check">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="step-section">
            <h3 className="step-heading font-serif">
              <Sparkles size={20} color="var(--gold-primary)" /> Bước 1.2: Chọn Gói Dịch Vụ
            </h3>
            <div className="booking-packages-grid">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className={`pkg-select-card ${selectedPackage?.id === pkg.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <div className="pkg-select-header">
                    <h4>{pkg.ten_goi}</h4>
                    <div className="pkg-price">
                      {new Intl.NumberFormat('vi-VN').format(pkg.gia_co_ban)} đ
                    </div>
                  </div>
                  <ul className="pkg-features">
                    <li>⏱ Thời lượng: {pkg.thoi_luong_phut} phút</li>
                    <li>🖼 Sửa hoàn thiện: {pkg.so_anh_chinh_sua} ảnh</li>
                    <li>👗 Tối đa: {pkg.so_trang_phuc_toi_da} bộ trang phục</li>
                  </ul>
                  {selectedPackage?.id === pkg.id && (
                    <div className="selected-check">
                      <Check size={16} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="step-section">
            <h3 className="step-heading font-serif">
              <Sparkles size={20} color="var(--gold-primary)" /> Bước 1.3: Dịch Vụ Cộng Thêm (Tùy Chọn)
            </h3>
            <div className="booking-addons-list">
              {addons.map((addon) => {
                const qty = selectedAddons[addon.id] || 0;
                return (
                  <div key={addon.id} className="addon-select-row">
                    <div className="addon-select-info">
                      <h4>{addon.ten_dich_vu}</h4>
                      <p>{addon.mo_ta}</p>
                      <div className="addon-unit-price">
                        +{new Intl.NumberFormat('vi-VN').format(addon.gia)} đ / {addon.don_vi_tinh}
                      </div>
                    </div>
                    <div className="addon-counter">
                      <button
                        className="counter-btn"
                        onClick={() => handleAddonQty(addon.id, -1)}
                        disabled={qty === 0}
                      >
                        -
                      </button>
                      <span className="counter-val">{qty}</span>
                      <button
                        className="counter-btn"
                        onClick={() => handleAddonQty(addon.id, 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="booking-footer-actions">
            <div></div>
            <button
              className="btn-primary"
              disabled={!selectedConcept || !selectedPackage}
              onClick={() => setStep(2)}
            >
              Tiếp Tục Chọn Ngày & Ca Chụp <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CHỌN NGÀY & CA CHỤP THỜI GIAN THỰC */}
      {step === 2 && (
        <div className="booking-step-content">
          <div className="step-section">
            <h3 className="step-heading font-serif">
              <Calendar size={20} color="var(--gold-primary)" /> Chọn Ngày Chụp Ảnh
            </h3>
            <div className="date-picker-box">
              <label>Ngày mong muốn chụp:</label>
              <input
                type="date"
                min={tomorrowStr}
                value={ngayChup}
                onChange={(e) => {
                  setNgayChup(e.target.value);
                  setSelectedSlot(null);
                }}
                className="date-input"
              />
              <p className="date-hint">
                💡 Hệ thống sẽ tự động kiểm tra số lượng thợ rảnh và tình trạng phòng chụp của concept <strong>"{selectedConcept?.ten_concept}"</strong>.
              </p>
            </div>
          </div>

          <div className="step-section">
            <h3 className="step-heading font-serif">
              <Clock size={20} color="var(--gold-primary)" /> Chọn Khung Giờ (Ca Chụp) Còn Trống
            </h3>

            {loadingAvailability ? (
              <div className="loading-state">
                <div className="spinner-inline"></div>
                <p>Đang kiểm tra lịch trống phòng và thợ chụp...</p>
              </div>
            ) : (
              <div className="time-slots-grid">
                {availabilityList.map((slot) => {
                  const isAvailable = slot.kha_dung;
                  const isSelected = selectedSlot?.khung_gio_id === slot.khung_gio_id;

                  return (
                    <div
                      key={slot.khung_gio_id}
                      className={`time-slot-card ${isAvailable ? 'available' : 'unavailable'} ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isAvailable) setSelectedSlot(slot);
                      }}
                    >
                      <div className="slot-header">
                        <span className="slot-name">{slot.ca_chup}</span>
                        {isAvailable ? (
                          <span className="slot-status-badge badge-emerald">Còn chỗ</span>
                        ) : (
                          <span className="slot-status-badge badge-rose">Kín lịch</span>
                        )}
                      </div>
                      <div className="slot-time">
                        {slot.gio_bat_dau.slice(0, 5)} - {slot.gio_ket_thuc.slice(0, 5)}
                      </div>
                      {isAvailable ? (
                        <div className="slot-meta">
                          {slot.so_tho_ranh !== undefined && (
                            <span>📸 Có {slot.so_tho_ranh} thợ chụp rảnh</span>
                          )}
                        </div>
                      ) : (
                        <div className="slot-reason">
                          <AlertCircle size={14} /> {slot.ly_do_het_cho || 'Đã có lịch kín'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="booking-footer-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Quay Lại
            </button>
            <button
              className="btn-primary"
              disabled={!selectedSlot}
              onClick={() => setStep(3)}
            >
              Tiếp Tục Điền Thông Tin <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: THÔNG TIN KHÁCH HÀNG & MÃ GIẢM GIÁ */}
      {step === 3 && (
        <div className="booking-step-content">
          <div className="step-3-layout">
            <div className="customer-info-form">
              <h3 className="step-heading font-serif">
                <User size={20} color="var(--gold-primary)" /> Thông Tin Khách Hàng
              </h3>

              {!user && (
                <div className="auth-alert-box">
                  <AlertCircle size={18} color="var(--amber-warning)" />
                  <div>
                    Bạn chưa đăng nhập. Vui lòng{' '}
                    <button
                      className="text-link"
                      onClick={() => openAuthModal('login')}
                    >
                      đăng nhập ngay
                    </button>{' '}
                    để lưu đơn vào tài khoản và theo dõi ảnh chụp.
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Họ và tên khách hàng</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={customerInfo.ho_ten}
                    onChange={(e) =>
                      setCustomerInfo({ ...customerInfo, ho_ten: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Số điện thoại liên hệ (nhận tin nhắn xác nhận & ảnh)</label>
                <div className="input-with-icon">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="tel"
                    required
                    placeholder="0912345678"
                    value={customerInfo.so_dien_thoai}
                    onChange={(e) =>
                      setCustomerInfo({ ...customerInfo, so_dien_thoai: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Địa chỉ Email</label>
                <div className="input-with-icon">
                  <Mail size={18} className="input-icon" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={customerInfo.email}
                    onChange={(e) =>
                      setCustomerInfo({ ...customerInfo, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Ghi chú đặc biệt cho Studio (tùy chọn)</label>
                <textarea
                  className="form-control form-control-no-icon"
                  rows={3}
                  placeholder="Ví dụ: Mong muốn phong cách trang điểm tone cam đào, cần thêm hỗ trợ phụ kiện hoa..."
                  value={customerInfo.ghi_chu_khach_hang}
                  onChange={(e) =>
                    setCustomerInfo({ ...customerInfo, ghi_chu_khach_hang: e.target.value })
                  }
                ></textarea>
              </div>

              {/* VOUCHER INPUT */}
              <div className="voucher-section">
                <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Mã Voucher Giảm Giá / Bảo Lưu Cọc:
                </label>
                <div className="voucher-input-row">
                  <input
                    type="text"
                    placeholder="Nhập mã voucher (VD: STUDIO50K, BAOLUU...)"
                    value={voucherCode}
                    onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleApplyVoucher}
                    disabled={loading}
                  >
                    Áp Dụng
                  </button>
                </div>
              </div>
            </div>

            {/* ORDER SUMMARY BILL */}
            <div className="order-summary-card">
              <h3 className="order-summary-title font-serif">Tóm Tắt Đơn Đặt Lịch</h3>

              <div className="summary-item">
                <span className="summary-label">Concept:</span>
                <span className="summary-val font-semibold">{selectedConcept?.ten_concept}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Gói chụp:</span>
                <span className="summary-val">{selectedPackage?.ten_goi}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Ngày chụp:</span>
                <span className="summary-val">{ngayChup}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Ca chụp:</span>
                <span className="summary-val">
                  {selectedSlot?.ca_chup} ({selectedSlot?.gio_bat_dau.slice(0, 5)} - {selectedSlot?.gio_ket_thuc.slice(0, 5)})
                </span>
              </div>

              <div className="summary-divider"></div>

              <div className="summary-item">
                <span>Giá gói cơ bản:</span>
                <span>{new Intl.NumberFormat('vi-VN').format(pricingSummary.gia_goi)} đ</span>
              </div>

              {pricingSummary.tong_tien_dich_vu_them > 0 && (
                <div className="summary-item">
                  <span>Dịch vụ thêm:</span>
                  <span>+{new Intl.NumberFormat('vi-VN').format(pricingSummary.tong_tien_dich_vu_them)} đ</span>
                </div>
              )}

              {voucherDiscount > 0 && (
                <div className="summary-item text-gold">
                  <span>Voucher giảm giá:</span>
                  <span>-{new Intl.NumberFormat('vi-VN').format(voucherDiscount)} đ</span>
                </div>
              )}

              <div className="summary-divider"></div>

              <div className="summary-total-row">
                <span>Tổng chi phí:</span>
                <span className="total-amount">
                  {new Intl.NumberFormat('vi-VN').format(pricingSummary.tong_tien)} đ
                </span>
              </div>

              <div className="deposit-highlight-box">
                <div className="deposit-row">
                  <span>Tiền cọc cần thanh toán (30%):</span>
                  <span className="deposit-amount">
                    {new Intl.NumberFormat('vi-VN').format(pricingSummary.tien_coc)} đ
                  </span>
                </div>
                <div className="remaining-row">
                  <span>Thanh toán tại Studio (70%):</span>
                  <span>{new Intl.NumberFormat('vi-VN').format(pricingSummary.tien_con_lai)} đ</span>
                </div>
              </div>

              <button
                className="btn-primary btn-block"
                style={{ marginTop: '20px' }}
                onClick={handleCreateBooking}
                disabled={loading}
              >
                {loading ? <span className="spinner-inline"></span> : 'Xác Nhận & Đặt Cọc 30%'}
              </button>
            </div>
          </div>

          <div className="booking-footer-actions">
            <button className="btn-secondary" onClick={() => setStep(2)}>
              <ArrowLeft size={16} /> Quay Lại
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: THANH TOÁN ĐẶT CỌC 30% TRỰC TUYẾN (VIETQR) */}
      {step === 4 && (
        <div className="booking-step-content">
          <div className="payment-container">
            {!isDepositPaid ? (
              <div className="payment-box">
                <div className="badge badge-gold" style={{ marginBottom: '12px' }}>
                  <QrCode size={16} /> Thanh Toán Đặt Cọc Trực Tuyến
                </div>
                <h2 className="font-serif">Quét Mã VietQR Chuyển Khoản</h2>
                <p className="payment-subtitle">
                  Hệ thống tạm giữ slot chụp trong <strong>15 phút</strong>. Quý khách vui lòng quét mã QR hoặc chuyển khoản đúng nội dung bên dưới.
                </p>

                <div className="payment-grid">
                  {/* QR Image */}
                  <div className="qr-wrapper">
                    <img
                      src={`https://img.vietqr.io/image/${paymentInfo?.ngan_hang || 'MB'}-${paymentInfo?.so_tai_khoan || '0908123456'}-compact2.png?amount=${paymentInfo?.so_tien_coc || pricingSummary.tien_coc}&addInfo=${paymentInfo?.noi_dung_chuyen_khoan || createdBooking?.ma_don}&accountName=BO%20PHOTO%20STUDIO`}
                      alt="VietQR Chuyển khoản đặt cọc"
                      className="qr-image"
                    />
                    <div className="qr-badge">Tự động nhận diện số tiền & nội dung</div>
                  </div>

                  {/* Transfer Details */}
                  <div className="transfer-details">
                    <div className="detail-row">
                      <span className="detail-label">Mã Đơn Đặt Lịch:</span>
                      <div className="detail-value-box">
                        <strong>{createdBooking?.ma_don}</strong>
                        <button
                          className="btn-copy"
                          onClick={() => copyToClipboard(createdBooking?.ma_don, 'Mã đơn')}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Ngân Hàng:</span>
                      <div className="detail-value">
                        {paymentInfo?.ngan_hang || 'MB Bank (Quân Đội)'}
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Số Tài Khoản:</span>
                      <div className="detail-value-box">
                        <strong>{paymentInfo?.so_tai_khoan || '0908 123 456'}</strong>
                        <button
                          className="btn-copy"
                          onClick={() => copyToClipboard(paymentInfo?.so_tai_khoan || '0908123456', 'Số tài khoản')}
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Chủ Tài Khoản:</span>
                      <div className="detail-value">BO PHOTO STUDIO</div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Số Tiền Đặt Cọc (30%):</span>
                      <div className="detail-value text-gold font-bold" style={{ fontSize: '1.2rem' }}>
                        {new Intl.NumberFormat('vi-VN').format(paymentInfo?.so_tien_coc || pricingSummary.tien_coc)} VNĐ
                      </div>
                    </div>

                    <div className="detail-row">
                      <span className="detail-label">Nội Dung Chuyển Khoản:</span>
                      <div className="detail-value-box">
                        <strong className="text-highlight">
                          {paymentInfo?.noi_dung_chuyen_khoan || createdBooking?.ma_don}
                        </strong>
                        <button
                          className="btn-copy"
                          onClick={() =>
                            copyToClipboard(
                              paymentInfo?.noi_dung_chuyen_khoan || createdBooking?.ma_don,
                              'Nội dung chuyển khoản'
                            )
                          }
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="payment-actions-box">
                  <button
                    className="btn-primary"
                    onClick={handleConfirmDeposit}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner-inline"></span> : '✓ Tôi Đã Chuyển Khoản Đặt Cọc Xong'}
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setActiveView('my-bookings')}
                  >
                    Xem Chi Tiết Đơn Hàng Của Tôi
                  </button>
                </div>
              </div>
            ) : (
              /* Success confirmation state */
              <div className="payment-success-card">
                <div className="success-icon-wrapper">
                  <CheckCircle2 size={54} color="var(--emerald-success)" />
                </div>
                <h2 className="font-serif">Đặt Lịch & Đặt Cọc Thành Công!</h2>
                <p className="success-msg">
                  Cảm ơn bạn đã lựa chọn Bơ Photo Studio. Mã đơn của bạn là{' '}
                  <strong>{createdBooking?.ma_don}</strong>. Chúng tôi đã gửi thông tin xác nhận và hướng dẫn chuẩn bị trang phục đến email của bạn.
                </p>

                <div className="success-actions">
                  <button
                    className="btn-primary"
                    onClick={() => setActiveView('my-bookings')}
                  >
                    Quản Lý Đơn Đặt Lịch Của Tôi
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setActiveView('home')}
                  >
                    Về Trang Chủ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
