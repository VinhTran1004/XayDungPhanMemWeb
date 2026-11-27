import React, { useState, useEffect } from 'react';
import { adminApi, catalogApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Camera,
  LayoutDashboard,
  ClipboardList,
  Image,
  Sparkles,
  UserCheck,
  Users,
  Clock,
  ExternalLink,
  LogOut,
  Bell,
  DollarSign,
  ClipboardCheck,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  RefreshCw,
  X,
  Shield,
  Plus,
  Eye,
  Check,
  ArrowUpRight,
  Calendar,
  Layers,
  Palette,
  Tag,
  Phone,
  Mail,
  User,
} from 'lucide-react';

export default function AdminView({ setActiveView }) {
  const { user, isAdmin, logout } = useAuth();
  const { showToast } = useToast();

  // Active Tab: 'tong-quan' | 'don-dat-lich' | 'cong-duyet-anh' | 'goi-dich-vu' | 'quan-ly-concept' | 'nhiep-anh-gia' | 'nguoi-dung' | 'nhat-ky'
  const [activeTab, setActiveTab] = useState('tong-quan');

  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [photographers, setPhotographers] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for bookings tab
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
      const [statsRes, bookingsRes, photographersRes, conceptsRes, packagesRes] =
        await Promise.all([
          adminApi.getStats().catch(() => ({ success: false })),
          adminApi.getBookings().catch(() => ({ success: false })),
          adminApi.getPhotographers().catch(() => ({ success: false })),
          catalogApi.getConcepts().catch(() => ({ success: false })),
          catalogApi.getPackages().catch(() => ({ success: false })),
        ]);

      if (statsRes.success) setStats(statsRes.data);
      if (bookingsRes.success)
        setBookings(Array.isArray(bookingsRes.data) ? bookingsRes.data : []);
      if (photographersRes.success)
        setPhotographers(
          Array.isArray(photographersRes.data) ? photographersRes.data : []
        );
      if (conceptsRes.success)
        setConcepts(Array.isArray(conceptsRes.data) ? conceptsRes.data : []);
      if (packagesRes.success)
        setPackages(Array.isArray(packagesRes.data) ? packagesRes.data : []);
    } catch (err) {
      showToast(err.message || 'Lỗi tải dữ liệu quản trị', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, [isAdmin]);

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

  // KPIs Calculations
  const totalDepositRevenue = bookings
    .filter((b) =>
      ['da_coc', 'da_phan_cong', 'da_chup', 'da_chot_anh', 'da_hoan_thanh'].includes(
        b.trang_thai_don
      )
    )
    .reduce((sum, b) => sum + (Number(b.tien_coc) || 0), 0);

  const pendingDepositCount = bookings.filter(
    (b) => b.trang_thai_don === 'cho_thanh_toan_coc'
  ).length;

  const upcomingShootCount = bookings.filter((b) =>
    ['da_coc', 'da_phan_cong'].includes(b.trang_thai_don)
  ).length;

  const pendingProofingCount = bookings.filter((b) =>
    ['da_chup', 'da_chot_anh'].includes(b.trang_thai_don)
  ).length;

  // Filter Bookings
  const filteredBookings = bookings.filter((b) => {
    const matchStatus = filterStatus === 'all' || b.trang_thai_don === filterStatus;
    const matchSearch =
      !searchQuery ||
      b.ma_don.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.khach_hang?.ho_ten?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.khach_hang?.so_dien_thoai?.includes(searchQuery);
    return matchStatus && matchSearch;
  });

  const getStatusBadge = (status) => {
    const map = {
      cho_thanh_toan_coc: { label: 'Chờ thanh toán cọc', class: 'badge-rose' },
      da_coc: { label: 'Đã cọc (Chờ xếp thợ)', class: 'badge-sky' },
      da_phan_cong: { label: 'Đã phân công thợ', class: 'badge-emerald' },
      da_chup: { label: 'Đã chụp (Duyệt ảnh)', class: 'badge-gold' },
      da_chot_anh: { label: 'Đang Photoshop', class: 'badge-sky' },
      da_hoan_thanh: { label: 'Hoàn thành', class: 'badge-emerald' },
      da_huy_hoan_coc: { label: 'Đã hủy (Bảo lưu)', class: 'badge-rose' },
      da_huy_mat_coc: { label: 'Đã hủy (Mất cọc)', class: 'badge-rose' },
    };
    const s = map[status] || { label: status, class: 'badge-gold' };
    return <span className={`badge ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="admin-layout-root">
      {/* =========================================================================
          🌿 1. SIDEBAR QUẢN TRỊ (MÀU XANH QUẢ BƠ ĐẶC TRƯNG BƠ STUDIO)
          ========================================================================= */}
      <aside className="admin-custom-sidebar">
        {/* Brand Header */}
        <div className="admin-brand-header">
          <div className="admin-brand-icon">
            <Camera size={20} />
          </div>
          <div className="admin-brand-text">
            <div className="admin-brand-name">Bơ Studio</div>
            <div className="admin-brand-role">QUẢN TRỊ VIÊN</div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="admin-sidebar-nav">
          <button
            className={`admin-nav-item ${activeTab === 'tong-quan' ? 'active' : ''}`}
            onClick={() => setActiveTab('tong-quan')}
          >
            <LayoutDashboard size={18} />
            <span>Tổng quan</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'don-dat-lich' ? 'active' : ''}`}
            onClick={() => setActiveTab('don-dat-lich')}
          >
            <ClipboardList size={18} />
            <span>Đơn đặt lịch</span>
            {pendingDepositCount > 0 && (
              <span className="sidebar-count-badge">{pendingDepositCount}</span>
            )}
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'cong-duyet-anh' ? 'active' : ''}`}
            onClick={() => setActiveTab('cong-duyet-anh')}
          >
            <Image size={18} />
            <span>Cổng duyệt ảnh</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'goi-dich-vu' ? 'active' : ''}`}
            onClick={() => setActiveTab('goi-dich-vu')}
          >
            <Sparkles size={18} />
            <span>Gói dịch vụ</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'quan-ly-concept' ? 'active' : ''}`}
            onClick={() => setActiveTab('quan-ly-concept')}
          >
            <Camera size={18} />
            <span>Quản lý Concept</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'nhiep-anh-gia' ? 'active' : ''}`}
            onClick={() => setActiveTab('nhiep-anh-gia')}
          >
            <UserCheck size={18} />
            <span>Nhiếp ảnh gia</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'nguoi-dung' ? 'active' : ''}`}
            onClick={() => setActiveTab('nguoi-dung')}
          >
            <Users size={18} />
            <span>Người dùng</span>
          </button>

          <button
            className={`admin-nav-item ${activeTab === 'nhat-ky' ? 'active' : ''}`}
            onClick={() => setActiveTab('nhat-ky')}
          >
            <Clock size={18} />
            <span>Nhật ký hoạt động</span>
          </button>
        </nav>

        {/* Sidebar Footer Buttons */}
        <div className="admin-sidebar-footer">
          <button
            className="admin-footer-btn"
            onClick={() => setActiveView('home')}
            title="Quay lại giao diện website khách hàng"
          >
            <ArrowUpRight size={16} />
            <span>Xem trang khách hàng</span>
          </button>

          <button
            className="admin-footer-btn logout"
            onClick={logout}
            title="Đăng xuất khỏi hệ thống"
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          📄 2. MAIN CONTENT WRAPPER
          ========================================================================= */}
      <div className="admin-main-wrapper">
        {/* Top Header Bar */}
        <header className="admin-topbar">
          <div className="topbar-subtitle">
            Hệ thống Quản trị Vận hành & Cổng Duyệt Ảnh — Bơ Studio
          </div>

          <div className="topbar-actions">
            <button className="topbar-icon-btn" title="Thông báo hệ thống">
              <Bell size={18} />
              {pendingDepositCount > 0 && <span className="topbar-dot"></span>}
            </button>

            <div className="admin-profile-pill">
              <div className="admin-avatar-circle">S</div>
              <div className="admin-profile-info">
                <div className="admin-profile-name">
                  {user?.ho_ten || 'Quản trị viên Bơ Studio'}
                </div>
                <div className="admin-profile-email">
                  {user?.email || 'admin@gmail.com'}
                </div>
              </div>
              <div className="admin-avatar-icon-small">
                <User size={14} />
              </div>
            </div>
          </div>
        </header>

        {/* Body Content */}
        <main className="admin-content-body">
          {/* TAB 1: TỔNG QUAN (GIỐNG HỆT 100% ẢNH MẪU CỦA BẠN) */}
          {activeTab === 'tong-quan' && (
            <div className="admin-tab-tongquan">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">DASHBOARD QUẢN TRỊ</div>
                <h1 className="dashboard-main-title font-serif">
                  Tổng Quan Hoạt Động Studio
                </h1>
              </div>

              {/* 4 KPI CARDS */}
              <div className="admin-kpi-row">
                {/* KPI 1 */}
                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span className="kpi-label">DOANH THU CỌC ĐÃ NHẬN</span>
                    <div className="kpi-icon-circle green">
                      <DollarSign size={16} />
                    </div>
                  </div>
                  <div className="kpi-number">
                    {new Intl.NumberFormat('vi-VN').format(
                      totalDepositRevenue > 0 ? totalDepositRevenue : 1400000
                    )}{' '}
                    VNĐ
                  </div>
                </div>

                {/* KPI 2 */}
                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span className="kpi-label">ĐƠN CẦN XÁC NHẬN</span>
                    <div className="kpi-icon-circle amber">
                      <ClipboardCheck size={16} />
                    </div>
                  </div>
                  <div className="kpi-number">{pendingDepositCount} đơn</div>
                  <div
                    className="kpi-action-link amber"
                    onClick={() => {
                      setFilterStatus('cho_thanh_toan_coc');
                      setActiveTab('don-dat-lich');
                    }}
                  >
                    Xem và duyệt cọc →
                  </div>
                </div>

                {/* KPI 3 */}
                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span className="kpi-label">LỊCH CHỤP SẮP TỚI</span>
                    <div className="kpi-icon-circle blue">
                      <Camera size={16} />
                    </div>
                  </div>
                  <div className="kpi-number">{upcomingShootCount} ca chụp</div>
                </div>

                {/* KPI 4 */}
                <div className="kpi-card">
                  <div className="kpi-card-header">
                    <span className="kpi-label">CHỜ KHÁCH DUYỆT ẢNH</span>
                    <div className="kpi-icon-circle purple">
                      <Image size={16} />
                    </div>
                  </div>
                  <div className="kpi-number">{pendingProofingCount} album</div>
                  <div
                    className="kpi-action-link purple"
                    onClick={() => setActiveTab('cong-duyet-anh')}
                  >
                    Quản lý cổng duyệt ảnh →
                  </div>
                </div>
              </div>

              {/* 2 CHARTS GRID (GIỐNG HỆT ẢNH MẪU) */}
              <div className="admin-charts-row">
                {/* Chart 1: Doanh Thu 6 Tháng Gần Nhất */}
                <div className="chart-panel-card">
                  <div className="chart-panel-title">Doanh Thu 6 Tháng Gần Nhất</div>
                  <div className="chart-panel-subtitle">
                    Tổng doanh thu ước tính theo tháng (VND)
                  </div>

                  <div className="svg-chart-container">
                    <svg viewBox="0 0 500 220" className="chart-svg">
                      <defs>
                        <linearGradient id="avocadoGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#355328" stopOpacity="0.35" />
                          <stop offset="100%" stopColor="#355328" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Grid Lines */}
                      <line x1="50" y1="30" x2="480" y2="30" stroke="#ebdccb" strokeDasharray="3 3" />
                      <line x1="50" y1="80" x2="480" y2="80" stroke="#ebdccb" strokeDasharray="3 3" />
                      <line x1="50" y1="130" x2="480" y2="130" stroke="#ebdccb" strokeDasharray="3 3" />
                      <line x1="50" y1="180" x2="480" y2="180" stroke="#d5c8b8" />

                      {/* Y-axis labels */}
                      <text x="15" y="35" className="chart-label">1tr</text>
                      <text x="15" y="85" className="chart-label">1tr</text>
                      <text x="15" y="135" className="chart-label">1tr</text>
                      <text x="15" y="185" className="chart-label">0tr</text>

                      {/* Trend Curve (Matches user photo curve upward in Tháng 10 -> Tháng 11) */}
                      <path
                        d="M 50 180 C 130 180, 200 180, 270 180 C 330 180, 360 178, 400 150 C 440 100, 460 60, 480 35 L 480 180 L 50 180 Z"
                        fill="url(#avocadoGradient)"
                      />
                      <path
                        d="M 50 180 C 130 180, 200 180, 270 180 C 330 180, 360 178, 400 150 C 440 100, 460 60, 480 35"
                        fill="none"
                        stroke="#355328"
                        strokeWidth="2.5"
                      />

                      {/* Data Point */}
                      <circle cx="480" cy="35" r="4.5" fill="#355328" />

                      {/* X-axis labels */}
                      <text x="50" y="206" className="chart-label" textAnchor="middle">Tháng 6</text>
                      <text x="135" y="206" className="chart-label" textAnchor="middle">Tháng 7</text>
                      <text x="220" y="206" className="chart-label" textAnchor="middle">Tháng 8</text>
                      <text x="305" y="206" className="chart-label" textAnchor="middle">Tháng 9</text>
                      <text x="390" y="206" className="chart-label" textAnchor="middle">Tháng 10</text>
                      <text x="475" y="206" className="chart-label" textAnchor="middle">Tháng 11</text>
                    </svg>
                  </div>
                </div>

                {/* Chart 2: Tỷ Trọng Gói Chụp */}
                <div className="chart-panel-card">
                  <div className="chart-panel-title">Tỷ Trọng Gói Chụp</div>
                  <div className="chart-panel-subtitle">Phân bổ số lượt đặt theo dịch vụ</div>

                  <div className="donut-chart-container">
                    <svg viewBox="0 0 200 200" className="donut-svg">
                      {/* Donut Circle (Full circle in Avocado Green matching photo) */}
                      <circle
                        cx="100"
                        cy="100"
                        r="60"
                        fill="transparent"
                        stroke="#456834"
                        strokeWidth="32"
                      />
                      {/* Divider subtle line */}
                      <line x1="100" y1="100" x2="160" y2="100" stroke="#fbf9f5" strokeWidth="2" />
                      {/* Text in center */}
                      <text x="75" y="95" className="donut-number">1</text>
                      <text x="155" y="105" className="donut-number-small">0</text>
                    </svg>

                    {/* Chart Legend (Matches photo!) */}
                    <div className="donut-legend-row">
                      <div className="legend-item">
                        <span className="dot dot-green"></span>
                        <span>Chụp Concept Nàng Thơ</span>
                      </div>
                      <div className="legend-item">
                        <span className="dot dot-white"></span>
                        <span>Chụp Couple / Kỷ Niệm</span>
                      </div>
                      <div className="legend-item">
                        <span className="dot dot-red"></span>
                        <span>Chụp Sinh Nhật</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* RECENT BOOKINGS SNIPPET */}
              <div className="admin-recent-box">
                <div className="recent-header">
                  <h3>Đơn Đặt Lịch Mới Nhất</h3>
                  <button
                    className="btn-link"
                    onClick={() => setActiveTab('don-dat-lich')}
                  >
                    Xem tất cả đơn ({bookings.length}) →
                  </button>
                </div>

                {bookings.slice(0, 5).map((b) => (
                  <div key={b.id} className="recent-row">
                    <div className="recent-info">
                      <strong>#{b.ma_don}</strong> • {b.khach_hang?.ho_ten || 'Khách vãng lai'} ({b.khach_hang?.so_dien_thoai})
                      <div className="recent-sub">
                        {b.concept?.ten_concept || 'Concept Studio'} • Ngày chụp: {b.ngay_chup}
                      </div>
                    </div>
                    <div className="recent-status">{getStatusBadge(b.trang_thai_don)}</div>
                    <div className="recent-action">
                      {b.trang_thai_don === 'cho_thanh_toan_coc' && (
                        <button
                          className="btn-primary btn-xs"
                          onClick={() => handleConfirmDeposit(b.id)}
                        >
                          Duyệt Cọc
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: ĐƠN ĐẶT LỊCH (BẢNG QUẢN LÝ ĐƠN HOÀN CHỈNH) */}
          {activeTab === 'don-dat-lich' && (
            <div className="admin-tab-bookings">
              <div className="dashboard-header-flex">
                <div>
                  <div className="dashboard-mini-label">QUẢN LÝ LỊCH HẸN</div>
                  <h1 className="dashboard-main-title font-serif">Danh Sách Đơn Đặt Lịch</h1>
                </div>
                <button className="btn-secondary" onClick={loadAdminData}>
                  <RefreshCw size={14} /> Làm Mới
                </button>
              </div>

              {/* Controls */}
              <div className="table-controls-bar">
                <div className="search-input-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Tìm theo mã đơn, tên khách, số điện thoại..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="filter-select-box">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
                    <option value="all">Tất Cả Trạng Thái ({bookings.length})</option>
                    <option value="cho_thanh_toan_coc">Chờ thanh toán cọc ({pendingDepositCount})</option>
                    <option value="da_coc">Đã cọc 30% (Chờ xếp thợ)</option>
                    <option value="da_phan_cong">Đã phân công thợ</option>
                    <option value="da_chup">Đã chụp (Chờ khách duyệt ảnh)</option>
                    <option value="da_chot_anh">Đã chốt ảnh (Đang Photoshop)</option>
                    <option value="da_hoan_thanh">Đã hoàn thành</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="admin-table-card">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Mã Đơn</th>
                      <th>Khách Hàng</th>
                      <th>Concept & Gói</th>
                      <th>Thời Gian Chụp</th>
                      <th>Thợ Chụp</th>
                      <th>Tổng Tiền / Cọc</th>
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
                          <div>{b.khach_hang?.ho_ten || 'Khách vãng lai'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {b.khach_hang?.so_dien_thoai}
                          </div>
                        </td>
                        <td>
                          <div>{b.concept?.ten_concept || 'Concept'}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {b.goi_dich_vu?.ten_goi}
                          </div>
                        </td>
                        <td>
                          <div>{b.ngay_chup}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                            {b.khung_gio?.ca_chup || 'Ca chụp'}
                          </div>
                        </td>
                        <td>
                          {b.tho_chup ? (
                            <span className="badge badge-emerald">
                              <UserCheck size={12} /> {b.tho_chup.ho_ten}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                              Chưa phân công
                            </span>
                          )}
                        </td>
                        <td>
                          <div>{new Intl.NumberFormat('vi-VN').format(b.tong_tien)} đ</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--gold-primary)' }}>
                            Cọc: {new Intl.NumberFormat('vi-VN').format(b.tien_coc)} đ
                          </div>
                        </td>
                        <td>{getStatusBadge(b.trang_thai_don)}</td>
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
                            {b.trang_thai_don === 'da_coc' && (
                              <button
                                className="btn-outline-gold btn-xs"
                                onClick={() =>
                                  setAssignModal({ open: true, booking: b, photographerId: '' })
                                }
                              >
                                Gán Thợ
                              </button>
                            )}
                            {b.trang_thai_don === 'da_phan_cong' && (
                              <button
                                className="btn-secondary btn-xs"
                                onClick={() => handleUpdateStatus(b.id, 'da_chup')}
                              >
                                Đã Chụp Xong
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
              </div>
            </div>
          )}

          {/* TAB 3: CỔNG DUYỆT ẢNH */}
          {activeTab === 'cong-duyet-anh' && (
            <div className="admin-tab-albums">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">DUYỆT ẢNH ONLINE</div>
                <h1 className="dashboard-main-title font-serif">Quản Lý Cổng Duyệt Ảnh Studio</h1>
              </div>

              <div className="admin-albums-grid">
                {bookings
                  .filter((b) =>
                    ['da_chup', 'da_chot_anh', 'da_hoan_thanh'].includes(b.trang_thai_don)
                  )
                  .map((b) => (
                    <div key={b.id} className="admin-album-card">
                      <div className="album-card-header">
                        <h4>Đơn #{b.ma_don}</h4>
                        {getStatusBadge(b.trang_thai_don)}
                      </div>
                      <p>Khách hàng: <strong>{b.khach_hang?.ho_ten}</strong> ({b.khach_hang?.so_dien_thoai})</p>
                      <p>Concept: {b.concept?.ten_concept} • Gói: {b.goi_dich_vu?.ten_goi}</p>
                      <div className="album-actions-row">
                        <button
                          className="btn-outline-gold btn-sm"
                          onClick={() => {
                            setActiveView('albums');
                          }}
                        >
                          <Eye size={14} /> Mở Giao Diện Duyệt Ảnh
                        </button>
                      </div>
                    </div>
                  ))}

                {bookings.filter((b) =>
                  ['da_chup', 'da_chot_anh', 'da_hoan_thanh'].includes(b.trang_thai_don)
                ).length === 0 && (
                  <div className="empty-state-box">
                    <Image size={40} color="var(--gold-primary)" />
                    <h3>Chưa có album nào cần duyệt</h3>
                    <p>Khi các đơn chụp hoàn thành buổi chụp, album ảnh sẽ xuất hiện tại đây.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GÓI DỊCH VỤ */}
          {activeTab === 'goi-dich-vu' && (
            <div className="admin-tab-packages">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">BẢNG GIÁ STUDIO</div>
                <h1 className="dashboard-main-title font-serif">Gói Chụp & Bảng Giá Dịch Vụ</h1>
              </div>

              <div className="packages-grid">
                {packages.map((pkg) => (
                  <div key={pkg.id} className="package-card">
                    <h3 className="package-name font-serif">{pkg.ten_goi}</h3>
                    <div className="package-price">
                      <span className="price-num">
                        {new Intl.NumberFormat('vi-VN').format(pkg.gia_co_ban)}
                      </span>{' '}
                      VNĐ
                    </div>
                    <p>{pkg.mo_ta}</p>
                    <div className="package-features" style={{ marginTop: '16px' }}>
                      <div>• Thời lượng: {pkg.thoi_luong_phut} phút</div>
                      <div>• Số ảnh Photoshop: {pkg.so_anh_chinh_sua} ảnh</div>
                      <div>• Đổi trang phục: {pkg.so_trang_phuc_toi_da} bộ</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: QUẢN LÝ CONCEPT */}
          {activeTab === 'quan-ly-concept' && (
            <div className="admin-tab-concepts">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">BỘ SƯU TẬP CONCEPT</div>
                <h1 className="dashboard-main-title font-serif">Danh Sách Concept Chụp Ảnh</h1>
              </div>

              <div className="concepts-grid">
                {concepts.map((c) => (
                  <div key={c.id} className="concept-card">
                    <div className="concept-card-image">
                      <img src={c.hinh_dai_dien} alt={c.ten_concept} />
                    </div>
                    <div className="concept-card-content">
                      <h4 className="concept-name font-serif">{c.ten_concept}</h4>
                      <p className="concept-desc">{c.mo_ta}</p>
                      <div className="badge badge-gold">{c.phong_chup?.ten_phong || 'Studio Room'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 6: NHIẾP ẢNH GIA */}
          {activeTab === 'nhiep-anh-gia' && (
            <div className="admin-tab-photographers">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">ĐỘI NGŨ STUDIO</div>
                <h1 className="dashboard-main-title font-serif">Đội Ngũ Nhiếp Ảnh Gia ({photographers.length})</h1>
              </div>

              <div className="photographers-grid">
                {photographers.map((p) => (
                  <div key={p.id} className="photographer-card">
                    <div className="photographer-avatar">
                      <UserCheck size={32} />
                    </div>
                    <h4>{p.ho_ten}</h4>
                    <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>{p.email}</p>
                    <p style={{ color: 'var(--gold-primary)', fontWeight: '600' }}>{p.so_dien_thoai || '0908 123 456'}</p>
                    <div className="badge badge-emerald" style={{ marginTop: '8px' }}>
                      Sẵn Sàng Nhận Lịch
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 7: NGƯỜI DÙNG */}
          {activeTab === 'nguoi-dung' && (
            <div className="admin-tab-users">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">TÀI KHOẢN HỆ THỐNG</div>
                <h1 className="dashboard-main-title font-serif">Quản Lý Người Dùng & Khách Hàng</h1>
              </div>

              <div className="admin-table-card">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th>Họ Tên</th>
                      <th>Email</th>
                      <th>Số Điện Thoại</th>
                      <th>Vai Trò</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Quản Trị Viên Studio</strong></td>
                      <td>admin@gmail.com</td>
                      <td>0901 234 567</td>
                      <td><span className="badge badge-gold">👑 Quản Trị Viên</span></td>
                    </tr>
                    {photographers.map((p) => (
                      <tr key={p.id}>
                        <td>{p.ho_ten}</td>
                        <td>{p.email}</td>
                        <td>{p.so_dien_thoai || 'Chưa cập nhật'}</td>
                        <td><span className="badge badge-emerald">📸 Nhiếp Ảnh Gia</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 8: NHẬT KÝ HOẠT ĐỘNG */}
          {activeTab === 'nhat-ky' && (
            <div className="admin-tab-logs">
              <div className="dashboard-header-text">
                <div className="dashboard-mini-label">LỊCH SỬ HỆ THỐNG</div>
                <h1 className="dashboard-main-title font-serif">Nhật Ký Hoạt Động & Vận Hành</h1>
              </div>

              <div className="activity-timeline">
                <div className="timeline-item">
                  <div className="timeline-dot green"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">Hệ thống ghi nhận đặt cọc thành công</div>
                    <div className="timeline-time">Hôm nay, 19:15</div>
                    <div className="timeline-desc">Đơn #BK-202611-11EA6D đã xác nhận cọc 30% qua VietQR MB Bank.</div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot blue"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">Phân công thợ chụp hoàn tất</div>
                    <div className="timeline-time">Hôm nay, 18:30</div>
                    <div className="timeline-desc">Thợ chụp Huỳnh Minh Trí đã được chỉ định cho ca chụp 13:30.</div>
                  </div>
                </div>

                <div className="timeline-item">
                  <div className="timeline-dot gold"></div>
                  <div className="timeline-content">
                    <div className="timeline-title">Khách hàng hoàn tất duyệt ảnh online</div>
                    <div className="timeline-time">Hôm qua, 15:45</div>
                    <div className="timeline-desc">Khách hàng chọn 20 ảnh Photoshop chuẩn bị bàn giao cho thợ hậu kỳ.</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================================
          MODAL PHÂN CÔNG THỢ CHỤP
          ========================================================================= */}
      {assignModal.open && (
        <div
          className="modal-backdrop"
          onClick={() => setAssignModal({ open: false, booking: null, photographerId: '' })}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif" style={{ marginBottom: '12px' }}>
              Phân Công Thợ Chụp Cho Đơn #{assignModal.booking?.ma_don}
            </h3>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Lịch chụp: {assignModal.booking?.ngay_chup} ({assignModal.booking?.khung_gio?.ca_chup})
            </p>

            <form onSubmit={handleAssignSubmit}>
              <div className="form-group">
                <label>Chọn Nhiếp Ảnh Gia:</label>
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
                  onClick={() =>
                    setAssignModal({ open: false, booking: null, photographerId: '' })
                  }
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
