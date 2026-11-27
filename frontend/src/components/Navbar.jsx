import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Camera,
  Calendar,
  User,
  LogOut,
  Shield,
  Image,
  FolderKanban,
  ChevronDown,
  Sparkles,
} from 'lucide-react';

export default function Navbar({ activeView, setActiveView }) {
  const { user, logout, openAuthModal, isAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleNavClick = (view) => {
    setActiveView(view);
    setDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        {/* Brand Logo */}
        <div className="brand-logo" onClick={() => handleNavClick('home')}>
          <div className="brand-icon">
            <Camera size={22} />
          </div>
          <div>
            Bơ Photo <span className="brand-highlight">Studio</span>
          </div>
        </div>

        {/* Desktop Navigation Links (Chỉ giữ các trang công khai chính) */}
        <nav className="nav-links">
          <button
            className={`nav-link ${activeView === 'home' ? 'active' : ''}`}
            onClick={() => handleNavClick('home')}
          >
            Trang Chủ
          </button>
          <button
            className={`nav-link ${activeView === 'concepts' ? 'active' : ''}`}
            onClick={() => handleNavClick('concepts')}
          >
            Concept & Portfolio
          </button>
          <button
            className={`nav-link ${activeView === 'pricing' ? 'active' : ''}`}
            onClick={() => handleNavClick('pricing')}
          >
            Bảng Giá Gói Chụp
          </button>
          <button
            className={`nav-link ${activeView === 'rooms' ? 'active' : ''}`}
            onClick={() => handleNavClick('rooms')}
          >
            Phòng Chụp
          </button>
        </nav>

        {/* Action Buttons */}
        <div className="nav-actions">
          <button
            className="btn-primary"
            onClick={() => handleNavClick('booking')}
          >
            <Calendar size={16} /> Đặt Lịch Ngay
          </button>

          {!user ? (
            <button
              className="btn-secondary"
              onClick={() => openAuthModal('login')}
            >
              <User size={16} /> Đăng Nhập
            </button>
          ) : (
            <div className="user-menu-wrapper">
              <button
                className="user-btn"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                title="Tài khoản cá nhân"
              >
                <div className="user-avatar">
                  {user.ho_ten ? user.ho_ten.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="user-name-text">{user.ho_ten}</span>
                <ChevronDown size={14} style={{ opacity: 0.7 }} />
              </button>

              {dropdownOpen && (
                <div className="user-dropdown" onClick={() => setDropdownOpen(false)}>
                  <div className="user-dropdown-header">
                    <div className="user-dropdown-name">{user.ho_ten}</div>
                    <div className="user-dropdown-email">{user.email}</div>
                    <div className="badge badge-gold" style={{ marginTop: '6px' }}>
                      {user.vai_tro === 'quan_tri_vien'
                        ? '👑 Quản Trị Viên'
                        : user.vai_tro === 'tho_chup'
                        ? '📸 Nhiếp Ảnh Gia'
                        : '👤 Khách Hàng'}
                    </div>
                  </div>

                  <div className="user-dropdown-nav">
                    {/* Lịch Hẹn & Voucher Của Tôi */}
                    <button
                      className={`user-dropdown-item ${activeView === 'my-bookings' ? 'active-item' : ''}`}
                      onClick={() => handleNavClick('my-bookings')}
                    >
                      <FolderKanban size={16} />
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">Lịch Hẹn & Voucher Của Tôi</div>
                        <div className="dropdown-item-sub">Theo dõi đơn, đổi ngày & mã cọc</div>
                      </div>
                    </button>

                    {/* Duyệt Ảnh Trực Tuyến */}
                    <button
                      className={`user-dropdown-item ${activeView === 'albums' ? 'active-item' : ''}`}
                      onClick={() => handleNavClick('albums')}
                    >
                      <Image size={16} />
                      <div className="dropdown-item-text">
                        <div className="dropdown-item-title">Duyệt & Chọn Ảnh Online</div>
                        <div className="dropdown-item-sub">Tick chọn ảnh Photoshop tại nhà</div>
                      </div>
                    </button>

                    {/* Trang Quản Trị Studio (Nếu là Admin) */}
                    {isAdmin && (
                      <button
                        className={`user-dropdown-item admin-link ${activeView === 'admin' ? 'active-item' : ''}`}
                        onClick={() => handleNavClick('admin')}
                      >
                        <Shield size={16} />
                        <div className="dropdown-item-text">
                          <div className="dropdown-item-title">Quản Trị Studio (Admin)</div>
                          <div className="dropdown-item-sub">Duyệt cọc, phân công thợ & doanh thu</div>
                        </div>
                      </button>
                    )}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

                  <button
                    className="user-dropdown-item danger"
                    onClick={logout}
                  >
                    <LogOut size={16} />
                    <span style={{ fontWeight: '500' }}>Đăng Xuất</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
