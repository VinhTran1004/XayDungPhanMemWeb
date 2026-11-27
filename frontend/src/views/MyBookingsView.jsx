import React, { useState, useEffect } from 'react';
import { bookingApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  Tag,
  RefreshCw,
  XCircle,
  Image,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  CreditCard,
  Copy,
} from 'lucide-react';

export default function MyBookingsView({ setActiveView, onOpenAlbum }) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('bookings'); // 'bookings' | 'vouchers'
  const [bookings, setBookings] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Reschedule Modal
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    booking: null,
    newDate: '',
    newSlotId: '',
  });

  // Cancel Modal
  const [cancelModal, setCancelModal] = useState({
    open: false,
    booking: null,
    phuongAn: 'voucher_100', // 'voucher_100' | 'hoan_tien_50'
  });

  // Pay Deposit Modal (Tiếp tục thanh toán cọc cho đơn đang chờ)
  const [payModal, setPayModal] = useState({
    open: false,
    booking: null,
    loading: false,
  });

  // Sao chép nội dung vào Clipboard
  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showToast(`Đã sao chép ${label}!`, 'info');
  };

  // Xác nhận chuyển khoản cọc 30% trực tiếp từ trang Lịch Hẹn
  const handleConfirmPayDeposit = async () => {
    if (!payModal.booking) return;
    setPayModal((prev) => ({ ...prev, loading: true }));
    try {
      const res = await bookingApi.payDeposit(payModal.booking.id, {
        hinh_thuc: 'chuyen_khoan',
        ma_giao_dich: `TXN_${Date.now()}`,
      });

      if (res.success) {
        showToast('Xác nhận đặt cọc 30% thành công! Chúc bạn có buổi chụp ảnh tuyệt vời.', 'success');
        setPayModal({ open: false, booking: null, loading: false });
        loadData();
      }
    } catch (err) {
      showToast(err.message || 'Lỗi xác nhận thanh toán cọc', 'error');
      setPayModal((prev) => ({ ...prev, loading: false }));
    }
  };

  const loadData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [bookingsRes, vouchersRes] = await Promise.all([
        bookingApi.getMyBookings(),
        bookingApi.getMyVouchers(),
      ]);

      if (bookingsRes.success && bookingsRes.data) {
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      }
      if (vouchersRes.success && vouchersRes.data) {
        setVouchers(Array.isArray(vouchersRes.data) ? vouchersRes.data : []);
      }
    } catch (err) {
      console.error('Lỗi tải đơn của tôi:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Handle Reschedule
  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleModal.newDate || !rescheduleModal.newSlotId) {
      showToast('Vui lòng chọn ngày và ca chụp mới', 'warning');
      return;
    }

    try {
      const res = await bookingApi.reschedule(rescheduleModal.booking.id, {
        ngay_chup: rescheduleModal.newDate,
        khung_gio_id: Number(rescheduleModal.newSlotId),
      });

      if (res.success) {
        showToast('Đổi lịch chụp thành công!', 'success');
        setRescheduleModal({ open: false, booking: null, newDate: '', newSlotId: '' });
        loadData();
      }
    } catch (err) {
      showToast(err.message || 'Không thể đổi lịch chụp', 'error');
    }
  };

  // Handle Cancel
  const handleCancelSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await bookingApi.cancelBooking(cancelModal.booking.id, {
        phuong_an: cancelModal.phuongAn,
      });

      if (res.success) {
        showToast('Đã hủy đơn đặt lịch theo yêu cầu', 'success');
        setCancelModal({ open: false, booking: null, phuongAn: 'voucher_100' });
        loadData();
      }
    } catch (err) {
      showToast(err.message || 'Không thể hủy đơn', 'error');
    }
  };

  if (!user) {
    return (
      <div className="container section-padding text-center">
        <div className="empty-state-box">
          <Calendar size={48} color="var(--gold-primary)" />
          <h2 className="font-serif">Bạn Chưa Đăng Nhập</h2>
          <p>Vui lòng đăng nhập để xem danh sách lịch hẹn và kho voucher của bạn.</p>
          <button className="btn-primary" onClick={() => openAuthModal('login')}>
            Đăng Nhập Ngay
          </button>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status) => {
    const map = {
      cho_thanh_toan_coc: { label: 'Chờ Đặt Cọc', class: 'badge-rose' },
      da_coc: { label: 'Đã Cọc (Chờ Xếp Thợ)', class: 'badge-sky' },
      da_phan_cong: { label: 'Đã Phân Công Thợ', class: 'badge-emerald' },
      da_chup: { label: 'Đã Chụp (Đang Duyệt Ảnh)', class: 'badge-gold' },
      da_chot_anh: { label: 'Đang Photoshop Hậu Kỳ', class: 'badge-sky' },
      da_hoan_thanh: { label: 'Hoàn Thành', class: 'badge-emerald' },
      da_huy_hoan_coc: { label: 'Đã Hủy (Đã Bảo Lưu/Hoàn)', class: 'badge-rose' },
      da_huy_mat_coc: { label: 'Đã Hủy (Mất Cọc)', class: 'badge-rose' },
    };
    const s = map[status] || { label: status, class: 'badge-gold' };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="container section-padding">
      <div className="section-header text-center">
        <div className="badge badge-gold">Quản Lý Lịch Hẹn</div>
        <h1 className="section-title font-serif">Lịch Hẹn & Voucher Của Tôi</h1>
        <p className="section-subtitle">
          Theo dõi trạng thái đơn đặt lịch, đổi ngày chụp hoặc sử dụng mã voucher bảo lưu cọc
        </p>

        {/* Tab switcher */}
        <div className="tabs-header-center">
          <button
            className={`tab-btn-pill ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookings')}
          >
            Lịch Đặt Chụp ({bookings.length})
          </button>
          <button
            className={`tab-btn-pill ${activeTab === 'vouchers' ? 'active' : ''}`}
            onClick={() => setActiveTab('vouchers')}
          >
            Kho Voucher Cọc ({vouchers.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner-inline"></div>
          <p>Đang tải dữ liệu...</p>
        </div>
      ) : activeTab === 'bookings' ? (
        /* BOOKINGS LIST */
        bookings.length === 0 ? (
          <div className="empty-state-box">
            <Calendar size={48} color="var(--gold-primary)" />
            <h3 className="font-serif">Chưa Có Đơn Đặt Lịch Nào</h3>
            <p>Bạn chưa có lịch hẹn chụp nào tại Bơ Photo Studio.</p>
            <button className="btn-primary" onClick={() => setActiveView('booking')}>
              Đặt Lịch Chụp Ngay
            </button>
          </div>
        ) : (
          <div className="my-bookings-grid">
            {bookings.map((booking) => (
              <div key={booking.id} className="booking-card-item">
                <div className="booking-card-header">
                  <div>
                    <div className="booking-code">MÃ ĐƠN: #{booking.ma_don}</div>
                    <div className="booking-date-sub">
                      Ngày tạo: {new Date(booking.created_at || Date.now()).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <div>{getStatusBadge(booking.trang_thai_don)}</div>
                </div>

                <div className="booking-card-body">
                  <div className="booking-detail-row">
                    <span className="label">Concept:</span>
                    <strong className="val">{booking.concept?.ten_concept || 'Concept Studio'}</strong>
                  </div>
                  <div className="booking-detail-row">
                    <span className="label">Gói chụp:</span>
                    <span className="val">{booking.goi_dich_vu?.ten_goi || 'Gói Chụp'}</span>
                  </div>
                  <div className="booking-detail-row">
                    <span className="label">Thời gian chụp:</span>
                    <span className="val text-gold font-bold">
                      {booking.ngay_chup} • {booking.khung_gio?.ca_chup} ({booking.khung_gio?.gio_bat_dau.slice(0, 5)} - {booking.khung_gio?.gio_ket_thuc.slice(0, 5)})
                    </span>
                  </div>
                  {booking.tho_chup && (
                    <div className="booking-detail-row">
                      <span className="label">Nhiếp ảnh gia:</span>
                      <span className="val">📸 {booking.tho_chup.ho_ten}</span>
                    </div>
                  )}

                  <div className="booking-price-badge-row">
                    <div>
                      <div className="price-label">Tổng tiền:</div>
                      <div className="price-val">
                        {new Intl.NumberFormat('vi-VN').format(booking.tong_tien)} đ
                      </div>
                    </div>
                    <div>
                      <div className="price-label">Tiền cọc:</div>
                      <div className="price-val text-gold">
                        {new Intl.NumberFormat('vi-VN').format(booking.tien_coc)} đ
                      </div>
                    </div>
                    <div>
                      <div className="price-label">Còn lại:</div>
                      <div className="price-val">
                        {new Intl.NumberFormat('vi-VN').format(booking.tien_con_lai)} đ
                      </div>
                    </div>
                  </div>
                </div>

                <div className="booking-card-footer">
                  {/* Photo Proofing shortcut */}
                  {['da_chup', 'da_chot_anh', 'da_hoan_thanh'].includes(booking.trang_thai_don) && (
                    <button
                      className="btn-outline-gold btn-sm"
                      onClick={() => {
                        if (onOpenAlbum) onOpenAlbum(booking.id);
                        setActiveView('albums');
                      }}
                    >
                      <Image size={14} /> Duyệt & Chọn Ảnh
                    </button>
                  )}

                  {/* Nút Tiếp Tục Đặt Cọc khi đơn đang ở trạng thái 'cho_thanh_toan_coc' */}
                  {booking.trang_thai_don === 'cho_thanh_toan_coc' && (
                    <button
                      className="btn-primary btn-sm"
                      onClick={() =>
                        setPayModal({
                          open: true,
                          booking,
                          loading: false,
                        })
                      }
                    >
                      <CreditCard size={14} /> Tiếp Tục Đặt Cọc
                    </button>
                  )}

                  {/* Reschedule button (if allowed) */}
                  {['da_coc', 'da_phan_cong'].includes(booking.trang_thai_don) && (
                    <button
                      className="btn-secondary btn-sm"
                      onClick={() =>
                        setRescheduleModal({
                          open: true,
                          booking,
                          newDate: booking.ngay_chup,
                          newSlotId: '',
                        })
                      }
                    >
                      <RefreshCw size={14} /> Đổi Lịch (24h)
                    </button>
                  )}

                  {/* Cancel button */}
                  {['cho_thanh_toan_coc', 'da_coc', 'da_phan_cong'].includes(booking.trang_thai_don) && (
                    <button
                      className="btn-danger btn-sm"
                      onClick={() =>
                        setCancelModal({
                          open: true,
                          booking,
                          phuongAn: 'voucher_100',
                        })
                      }
                    >
                      <XCircle size={14} /> Hủy Lịch
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* VOUCHERS LIST */
        vouchers.length === 0 ? (
          <div className="empty-state-box">
            <Tag size={48} color="var(--gold-primary)" />
            <h3 className="font-serif">Chưa Có Voucher Nào</h3>
            <p>Khi hủy lịch trước 48h, bạn sẽ nhận được mã voucher bảo lưu 100% tiền cọc tại đây.</p>
          </div>
        ) : (
          <div className="vouchers-grid">
            {vouchers.map((v) => (
              <div key={v.id} className="voucher-card">
                <div className="voucher-left">
                  <Tag size={24} color="var(--gold-primary)" />
                </div>
                <div className="voucher-right">
                  <div className="voucher-code-row">
                    <span className="voucher-code">{v.ma_voucher}</span>
                    <span className={`badge ${v.trang_thai ? 'badge-emerald' : 'badge-rose'}`}>
                      {v.trang_thai ? 'Khả Dụng' : 'Đã Sử Dụng'}
                    </span>
                  </div>
                  <div className="voucher-amount">
                    Giảm: {new Intl.NumberFormat('vi-VN').format(v.gia_tri_giam)} VNĐ
                  </div>
                  <div className="voucher-desc">{v.mo_ta}</div>
                  <div className="voucher-expiry">
                    Hạn dùng: {new Date(v.ngay_het_han).toLocaleDateString('vi-VN')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* RESCHEDULE MODAL */}
      {rescheduleModal.open && (
        <div className="modal-backdrop" onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newSlotId: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif" style={{ marginBottom: '12px' }}>
              Đổi Ngày & Ca Chụp Mới
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Mã đơn: #{rescheduleModal.booking?.ma_don}. Bạn được đổi lịch miễn phí khi thực hiện trước tối thiểu 24 giờ.
            </p>

            <form onSubmit={handleRescheduleSubmit}>
              <div className="form-group">
                <label>Chọn Ngày Mới</label>
                <input
                  type="date"
                  required
                  min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                  value={rescheduleModal.newDate}
                  onChange={(e) =>
                    setRescheduleModal({ ...rescheduleModal, newDate: e.target.value })
                  }
                  className="form-control form-control-no-icon"
                />
              </div>

              <div className="form-group">
                <label>Chọn Khung Giờ Mới</label>
                <select
                  required
                  className="form-control form-control-no-icon"
                  value={rescheduleModal.newSlotId}
                  onChange={(e) =>
                    setRescheduleModal({ ...rescheduleModal, newSlotId: e.target.value })
                  }
                >
                  <option value="">-- Chọn Ca Chụp --</option>
                  <option value="1">Ca 1: 08:30 - 10:00 (Sáng)</option>
                  <option value="2">Ca 2: 10:30 - 12:00 (Trưa)</option>
                  <option value="3">Ca 3: 13:30 - 15:00 (Chiều sớm)</option>
                  <option value="4">Ca 4: 15:30 - 17:00 (Chiều muộn)</option>
                  <option value="5">Ca 5: 17:30 - 19:00 (Tối sớm)</option>
                  <option value="6">Ca 6: 19:30 - 21:00 (Tối muộn)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setRescheduleModal({ open: false, booking: null, newDate: '', newSlotId: '' })}
                >
                  Hủy Bỏ
                </button>
                <button type="submit" className="btn-primary">
                  Xác Nhận Đổi Lịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL MODAL */}
      {cancelModal.open && (
        <div className="modal-backdrop" onClick={() => setCancelModal({ open: false, booking: null, phuongAn: 'voucher_100' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif" style={{ marginBottom: '12px', color: '#fb7185' }}>
              Xác Nhận Hủy Lịch Đặt
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Đơn hàng: #{cancelModal.booking?.ma_don} (Cọc:{' '}
              {new Intl.NumberFormat('vi-VN').format(cancelModal.booking?.tien_coc || 0)} đ).
            </p>

            <form onSubmit={handleCancelSubmit}>
              <div className="form-group">
                <label>Chọn Phương Án Xử Lý Tiền Cọc (Khi hủy trước 48h):</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="cancel_option"
                      value="voucher_100"
                      checked={cancelModal.phuongAn === 'voucher_100'}
                      onChange={() => setCancelModal({ ...cancelModal, phuongAn: 'voucher_100' })}
                    />
                    <span>
                      <strong>Nhận Voucher 100% Cọc</strong> (Bảo lưu 6 tháng cho lần chụp sau - Khuyên dùng)
                    </span>
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="cancel_option"
                      value="hoan_tien_50"
                      checked={cancelModal.phuongAn === 'hoan_tien_50'}
                      onChange={() => setCancelModal({ ...cancelModal, phuongAn: 'hoan_tien_50' })}
                    />
                    <span>
                      <strong>Hoàn Tiền 50% Cọc</strong> qua STK chuyển khoản
                    </span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCancelModal({ open: false, booking: null, phuongAn: 'voucher_100' })}
                >
                  Giữ Lại Lịch Hẹn
                </button>
                <button type="submit" className="btn-danger">
                  Đồng Ý Hủy Đơn
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* PAY DEPOSIT MODAL - VIETQR */}
      {payModal.open && payModal.booking && (
        <div
          className="modal-backdrop"
          onClick={() => setPayModal({ open: false, booking: null, loading: false })}
        >
          <div
            className="modal-content payment-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <h3 className="font-serif" style={{ marginBottom: '8px', textAlign: 'center' }}>
              Quét Mã VietQR Đặt Cọc 30%
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px', textAlign: 'center' }}>
              Quý khách vui lòng quét mã QR hoặc chuyển khoản đúng nội dung để hoàn tất giữ chỗ.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '24px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  textAlign: 'center',
                  background: '#ffffff',
                  padding: '16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                }}
              >
                <img
                  src={`https://img.vietqr.io/image/MB-0123456789-compact2.png?amount=${payModal.booking.tien_coc}&addInfo=${payModal.booking.ma_don}&accountName=BO%20PHOTO%20STUDIO`}
                  alt="VietQR MB Bank"
                  style={{ width: '100%', maxWidth: '210px', borderRadius: '8px' }}
                />
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                  Tự động nhận diện số tiền & nội dung
                </div>
              </div>

              <div className="transfer-details" style={{ gap: '10px' }}>
                <div className="detail-row">
                  <span className="detail-label">Mã Đơn:</span>
                  <div className="detail-value-box">
                    <strong>{payModal.booking.ma_don}</strong>
                    <button
                      className="btn-copy"
                      type="button"
                      onClick={() => copyToClipboard(payModal.booking.ma_don, 'Mã đơn')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Ngân Hàng:</span>
                  <div className="detail-value-box">
                    <span>MB Bank</span>
                  </div>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Số Tài Khoản:</span>
                  <div className="detail-value-box">
                    <strong>0123456789</strong>
                    <button
                      className="btn-copy"
                      type="button"
                      onClick={() => copyToClipboard('0123456789', 'Số tài khoản')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Chủ Tài Khoản:</span>
                  <div className="detail-value-box">
                    <span>BO PHOTO STUDIO</span>
                  </div>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Số Tiền Cọc (30%):</span>
                  <div className="detail-value-box">
                    <strong style={{ color: 'var(--gold-primary)', fontSize: '1.05rem' }}>
                      {new Intl.NumberFormat('vi-VN').format(payModal.booking.tien_coc)} VNĐ
                    </strong>
                    <button
                      className="btn-copy"
                      type="button"
                      onClick={() =>
                        copyToClipboard(payModal.booking.tien_coc?.toString(), 'Số tiền cọc')
                      }
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Nội Dung CK:</span>
                  <div className="detail-value-box">
                    <strong style={{ color: 'var(--gold-primary)' }}>{payModal.booking.ma_don}</strong>
                    <button
                      className="btn-copy"
                      type="button"
                      onClick={() => copyToClipboard(payModal.booking.ma_don, 'Nội dung chuyển khoản')}
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ flex: 1 }}
                onClick={() => setPayModal({ open: false, booking: null, loading: false })}
                disabled={payModal.loading}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn-primary"
                style={{ flex: 2 }}
                onClick={handleConfirmPayDeposit}
                disabled={payModal.loading}
              >
                {payModal.loading ? 'Đang xác nhận...' : '✓ Tôi Đã Chuyển Khoản Đặt Cọc Xong'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
