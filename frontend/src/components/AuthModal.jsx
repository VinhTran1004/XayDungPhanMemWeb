import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Mail, User, Phone, Sparkles, ShieldCheck } from 'lucide-react';

export default function AuthModal({ onAdminLogin }) {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalTab,
    setAuthModalTab,
    login,
    register,
  } = useAuth();

  const [loading, setLoading] = useState(false);

  // Form states
  const [email, setEmail] = useState('');
  const [matKhau, setMatKhau] = useState('');
  const [hoTen, setHoTen] = useState('');
  const [soDienThoai, setSoDienThoai] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (authModalTab === 'login') {
        const res = await login(email, matKhau);
        if (res?.user?.vai_tro === 'quan_tri_vien' && onAdminLogin) {
          onAdminLogin();
        }
      } else {
        await register({
          ho_ten: hoTen,
          email,
          so_dien_thoai: soDienThoai,
          mat_khau: matKhau,
        });
      }
    } catch {
      // Đã bắt lỗi & hiển thị qua toast
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (presetEmail, presetPass) => {
    setEmail(presetEmail);
    setMatKhau(presetPass);
    setLoading(true);
    try {
      const res = await login(presetEmail, presetPass);
      if (res?.user?.vai_tro === 'quan_tri_vien' && onAdminLogin) {
        onAdminLogin();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={closeAuthModal}>
      <div className="modal-content auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={closeAuthModal} aria-label="Đóng">
          <X size={20} />
        </button>

        <div className="auth-header">
          <div className="auth-brand-badge">
            <Sparkles size={16} /> Bơ Photo Studio
          </div>
          <h2>{authModalTab === 'login' ? 'Chào Mừng Trở Lại' : 'Đăng Ký Thành Viên'}</h2>
          <p className="auth-subtitle">
            {authModalTab === 'login'
              ? 'Đăng nhập để đặt lịch, duyệt ảnh và theo dõi album của bạn'
              : 'Tạo tài khoản để nhận ưu đãi và trải nghiệm dịch vụ studio chụp ảnh tốt nhất'}
          </p>

          <div className="auth-tabs">
            <button
              className={`auth-tab-btn ${authModalTab === 'login' ? 'active' : ''}`}
              onClick={() => setAuthModalTab('login')}
            >
              Đăng Nhập
            </button>
            <button
              className={`auth-tab-btn ${authModalTab === 'register' ? 'active' : ''}`}
              onClick={() => setAuthModalTab('register')}
            >
              Tạo Tài Khoản
            </button>
          </div>
        </div>

        {/* Quick test accounts for easy demo */}
        {authModalTab === 'login' && (
          <div className="quick-login-box">
            <div className="quick-login-title">
              <ShieldCheck size={14} /> Tài khoản Test nhanh (1 Click):
            </div>
            <div className="quick-login-buttons">
              <button
                type="button"
                className="btn-quick-login customer"
                onClick={() => handleQuickLogin('khachang@gmail.com', '123456')}
                disabled={loading}
              >
                👤 Khách hàng (khachang@gmail.com)
              </button>
              <button
                type="button"
                className="btn-quick-login admin"
                onClick={() => handleQuickLogin('admin@gmail.com', '123456')}
                disabled={loading}
              >
                👑 Quản trị viên (admin@gmail.com)
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {authModalTab === 'register' && (
            <>
              <div className="form-group">
                <label>Họ và tên</label>
                <div className="input-with-icon">
                  <User size={18} className="input-icon" />
                  <input
                    type="text"
                    required
                    placeholder="Nguyễn Văn A"
                    value={hoTen}
                    onChange={(e) => setHoTen(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Số điện thoại</label>
                <div className="input-with-icon">
                  <Phone size={18} className="input-icon" />
                  <input
                    type="tel"
                    required
                    placeholder="0912345678"
                    value={soDienThoai}
                    onChange={(e) => setSoDienThoai(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Địa chỉ Email</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Mật khẩu</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                required
                placeholder="Tối thiểu 6 ký tự"
                value={matKhau}
                onChange={(e) => setMatKhau(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn-primary btn-block auth-submit" disabled={loading}>
            {loading ? (
              <span className="spinner-inline"></span>
            ) : authModalTab === 'login' ? (
              'Đăng Nhập Ngay'
            ) : (
              'Đăng Ký Tài Khoản'
            )}
          </button>
        </form>

        <div className="auth-footer-prompt">
          {authModalTab === 'login' ? (
            <p>
              Chưa có tài khoản?{' '}
              <button
                type="button"
                className="text-link"
                onClick={() => setAuthModalTab('register')}
              >
                Đăng ký ngay
              </button>
            </p>
          ) : (
            <p>
              Đã có tài khoản?{' '}
              <button
                type="button"
                className="text-link"
                onClick={() => setAuthModalTab('login')}
              >
                Đăng nhập ngay
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
