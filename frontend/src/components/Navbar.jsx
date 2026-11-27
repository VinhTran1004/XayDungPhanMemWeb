import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Camera, Calendar, User, LogOut, Shield, Image, Sparkles, FolderKanban, Menu, X } from 'lucide-react';

export default function Navbar({ activeView, setActiveView, onOpenBookingWithConcept }) {
  const { user, logout, openAuthModal, isAdmin } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view) => {
    setActiveView(view);
    setMobileMenuOpen(false);
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

        {/* Desktop Navigation Links */}
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
          <button
            className={`nav-link ${activeView === 'albums' ? 'active' : ''}`}
            onClick={() => {
              if (!user) {
                openAuthModal('login');
              } else {
                handleNavClick('albums');
              }
            }}
          >
            Duyệt Ảnh Online
          </button>
          {user && (
            <button
              className={`nav-link ${activeView === 'my-bookings' ? 'active' : ''}`}
              onClick={() => handleNavClick('my-bookings')}
            >
              Lịch Hẹn Của Tôi
            </button>
          )}
          {isAdmin && (
            <button
              className={`nav-link ${activeView === 'admin' ? 'active' : ''}`}
              onClick={() => handleNavClick('admin')}
              style={{ color: 'var(--gold-primary)', fontWeight: '600' }}
            >
              ★ Quản Trị Studio
            </button>
          )}
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
              >
                <div className="user-avatar">
                  {user.ho_ten ? user.ho_ten.charAt(0).toUpperCase() : 'U'}
                </div>
                <span>{user.ho_ten}</span>
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

                  {isAdmin && (
                    <button
                      className="user-dropdown-item"
                      onClick={() => handleNavClick('admin')}
                    >
                      <Shield size={16} /> Quản Trị Hệ Thống
                    </button>
                  )}

                  <button
                    className="user-dropdown-item"
                    onClick={() => handleNavClick('my-bookings')}
                  >
                    <FolderKanban size={16} /> Đơn Đặt Lịch Của Tôi
                  </button>

                  <button
                    className="user-dropdown-item"
                    onClick={() => handleNavClick('albums')}
                  >
                    <Image size={16} /> Cổng Duyệt Ảnh Studio
                  </button>

                  <button
                    className="user-dropdown-item danger"
                    onClick={logout}
                  >
                    <LogOut size={16} /> Đăng Xuất
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger button */}
          <button
            className="mobile-toggle-btn"
            style={{ display: 'none' }}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
  );
}
