import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Shield,
  TrendingUp,
  Calendar,
  Users,
  CheckCircle,
  Clock,
  DollarSign,
  UserCheck,
  Check,
  Upload,
  CreditCard,
  Search,
  Filter,
} from 'lucide-react';

export default function AdminView({ setActiveView }) {
  const { user, isAdmin } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Assign Photographer Modal
  const [assignModal, setAssignModal] = useState({
    open: false,
    booking: null,
    photographerId: '',
  });

  const loadAdminData = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [statsRes, bookingsRes, photographersRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getBookings(),
        adminApi.getPhotographers(),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (bookingsRes.success) setBookings(bookingsRes.data);
      if (photographersRes.success) setPhotographers(photographersRes.data);
    } catch (err) {
      showToast(err.message || 'Lỗi tải dữ liệu quản trị', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="container section-padding text-center">
        <div className="empty-state-box">
          <Shield size={48} color="var(--rose-accent)" />
          <h2 className="font-serif">Khu Vực Dành Cho Quản Trị Viên</h2>
          <p>Tài khoản của bạn không có quyền truy cập trang quản trị hệ thống.</p>
          <button className="btn-secondary" onClick={() => setActiveView('home')}>
            Quay Về Trang Chủ
          </button>
        </div>
      </div>
    );
  }

  // Admin Actions
  const handleConfirmDeposit = async (bookingId) => {
    try {
      const res = await adminApi.confirmDeposit(bookingId);
      if (res.success) {
        showToast('Đã xác nhận duyệt cọc 30% cho khách hàng!', 'success');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Lỗi duyệt cọc', 'error');
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!assignModal.photographerId) {
      showToast('Vui lòng chọn thợ chụp', 'warning');
      return;
    }

    try {
      const res = await adminApi.assignPhotographer(
        assignModal.booking.id,
        Number(assignModal.photographerId)
      );
      if (res.success) {
        showToast('Đã phân công thợ chụp thành công!', 'success');
        setAssignModal({ open: false, booking: null, photographerId: '' });
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Lỗi phân công thợ', 'error');
    }
  };

  const handleUpdateStatus = async (bookingId, status) => {
    try {
      const res = await adminApi.updateStatus(bookingId, status);
      if (res.success) {
        showToast('Cập nhật trạng thái đơn thành công!', 'success');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Lỗi cập nhật trạng thái', 'error');
    }
  };

  const handleFinalPayment = async (bookingId) => {
    try {
      const res = await adminApi.finalPayment(bookingId, 'chuyen_khoan');
      if (res.success) {
        showToast('Đã ghi nhận tất toán 70% còn lại!', 'success');
        loadAdminData();
      }
    } catch (err) {
      showToast(err.message || 'Lỗi tất toán', 'error');
    }
  };

  // Filter logic
  const filteredBookings = bookings.filter((b) => {
    const matchStatus = filterStatus === 'all' || b.trang_thai_don === filterStatus;
    const matchSearch =
      !searchQuery ||
      b.ma_don.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.khach_hang?.ho_ten?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.khach_hang?.so_dien_thoai?.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  return (
    <div className="container section-padding admin-dashboard">
      <div className="section-header-flex">
        <div>
          <div className="badge badge-gold">Bảng Điều Khiển Quản Trị</div>
          <h1 className="section-title font-serif">Studio Management Dashboard</h1>
        </div>
        <button className="btn-secondary" onClick={loadAdminData}>
          Làm Mới Dữ Liệu
        </button>
      </div>

      {/* STATS OVERVIEW CARDS */}
      {stats && (
        <div className="admin-stats-grid">
          <div className="stat-card">
            <div className="stat-card-icon gold">
              <DollarSign size={24} />
            </div>
            <div className="stat-card-info">
              <div className="stat-card-label">Tổng Doanh Thu</div>
              <div className="stat-card-val text-gold">
                {new Intl.NumberFormat('vi-VN').format(stats.tong_doanh_thu || 0)} đ
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon sky">
              <Calendar size={24} />
            </div>
            <div className="stat-card-info">
              <div className="stat-card-label">Tổng Số Lịch Hẹn</div>
              <div className="stat-card-val">{stats.tong_so_don || 0} Đơn</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-icon emerald">
              <UserCheck size={24} />
            </div>
            <div className="stat-card-info">
              <div className="stat-card-label">Đội Ngũ Thợ Chụp</div>
              <div className="stat-card-val">{photographers.length} Nhân Sự</div>
            </div>
          </div>
        </div>
      )}

      {/* BOOKINGS MANAGEMENT TABLE */}
      <div className="admin-table-container">
        <div className="table-controls">
          <div className="filter-search-box" style={{ maxWidth: '320px' }}>
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Tìm theo mã đơn, khách, SĐT..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="filter-dropdown-wrapper">
            <select
              className="filter-select"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">Tất Cả Trạng Thái</option>
              <option value="cho_thanh_toan_coc">Chờ thanh toán cọc</option>
              <option value="da_coc">Đã cọc 30%</option>
              <option value="da_phan_cong">Đã phân công thợ</option>
              <option value="da_chup">Đã chụp ảnh</option>
              <option value="da_chot_anh">Đã chốt chọn ảnh</option>
              <option value="da_hoan_thanh">Hoàn thành</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner-inline"></div>
            <p>Đang tải dữ liệu đơn đặt lịch...</p>
          </div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Khách Hàng</th>
                <th>Concept & Gói</th>
                <th>Thời Gian Chụp</th>
                <th>Thợ Chụp</th>
                <th>Trạng Thái</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map((b) => (
                <tr key={b.id}>
                  <td>
                    <strong>#{b.ma_don}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600' }}>{b.khach_hang?.ho_ten || 'Khách'}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {b.khach_hang?.so_dien_thoai}
                    </div>
                  </td>
                  <td>
                    <div>{b.concept?.ten_concept}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      {b.goi_dich_vu?.ten_goi}
                    </div>
                  </td>
                  <td>
                    <div>{b.ngay_chup}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--gold-primary)' }}>
                      {b.khung_gio?.ca_chup}
                    </div>
                  </td>
                  <td>
                    {b.tho_chup ? (
                      <span className="badge badge-sky">📸 {b.tho_chup.ho_ten}</span>
                    ) : (
                      <button
                        className="btn-outline-gold btn-xs"
                        onClick={() =>
                          setAssignModal({
                            open: true,
                            booking: b,
                            photographerId: '',
                          })
                        }
                      >
                        + Phân Công
                      </button>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-gold">{b.trang_thai_don}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {b.trang_thai_don === 'cho_thanh_toan_coc' && (
                        <button
                          className="btn-primary btn-xs"
                          onClick={() => handleConfirmDeposit(b.id)}
                        >
                          Duyệt Cọc
                        </button>
                      )}

                      {b.trang_thai_don === 'da_phan_cong' && (
                        <button
                          className="btn-secondary btn-xs"
                          onClick={() => handleUpdateStatus(b.id, 'da_chup')}
                        >
                          Đã Chụp
                        </button>
                      )}

                      {b.trang_thai_don === 'da_chot_anh' && (
                        <button
                          className="btn-primary btn-xs"
                          onClick={() => handleFinalPayment(b.id)}
                        >
                          Tất Toán 70%
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ASSIGN PHOTOGRAPHER MODAL */}
      {assignModal.open && (
        <div className="modal-backdrop" onClick={() => setAssignModal({ open: false, booking: null, photographerId: '' })}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif" style={{ marginBottom: '12px' }}>
              Phân Công Thợ Chụp Cho Đơn #{assignModal.booking?.ma_don}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Lịch chụp: {assignModal.booking?.ngay_chup} ({assignModal.booking?.khung_gio?.ca_chup})
            </p>

            <form onSubmit={handleAssignSubmit}>
              <div className="form-group">
                <label>Chọn Thợ Chụp:</label>
                <select
                  required
                  className="form-control form-control-no-icon"
                  value={assignModal.photographerId}
                  onChange={(e) =>
                    setAssignModal({ ...assignModal, photographerId: e.target.value })
                  }
                >
                  <option value="">-- Danh Sách Nhiếp Ảnh Gia --</option>
                  {photographers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.ho_ten} ({p.email})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setAssignModal({ open: false, booking: null, photographerId: '' })}
                >
                  Đóng
                </button>
                <button type="submit" className="btn-primary">
                  Lưu Phân Công
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
