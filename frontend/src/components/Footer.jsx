import React from 'react';
import { Camera, MapPin, Phone, Mail, Clock, Globe } from 'lucide-react';

export default function Footer({ setActiveView }) {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          {/* Brand Col */}
          <div className="footer-col">
            <div className="brand-logo" onClick={() => setActiveView('home')}>
              <div className="brand-icon">
                <Camera size={20} />
              </div>
              <div>
                Bơ Photo <span className="brand-highlight">Studio</span>
              </div>
            </div>
            <p className="footer-desc">
              Không gian sáng tạo nghệ thuật nhiếp ảnh hiện đại hàng đầu. Chúng tôi trân trọng từng khoảnh khắc, kể lại câu chuyện của bạn qua từng khung hình cảm xúc và chỉn chu nhất.
            </p>
            <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
              <a href="https://instagram.com" target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '8px 12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
                  <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                </svg>
                Instagram
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" className="btn-secondary" style={{ padding: '8px 12px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
                </svg>
                Facebook
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div className="footer-col">
            <h4>Dịch Vụ</h4>
            <ul className="footer-links">
              <li>
                <a onClick={() => setActiveView('concepts')}>Chân Dung Cá Nhân</a>
              </li>
              <li>
                <a onClick={() => setActiveView('concepts')}>Chụp Ảnh Cặp Đôi (Couple)</a>
              </li>
              <li>
                <a onClick={() => setActiveView('concepts')}>Profile Doanh Nhân</a>
              </li>
              <li>
                <a onClick={() => setActiveView('concepts')}>Chụp Kỷ Yếu & Nhóm</a>
              </li>
              <li>
                <a onClick={() => setActiveView('pricing')}>Bảng Giá Gói Chụp</a>
              </li>
            </ul>
          </div>

          {/* Navigation */}
          <div className="footer-col">
            <h4>Hệ Thống</h4>
            <ul className="footer-links">
              <li>
                <a onClick={() => setActiveView('home')}>Về Chúng Tôi</a>
              </li>
              <li>
                <a onClick={() => setActiveView('rooms')}>Phòng Chụp Studio</a>
              </li>
              <li>
                <a onClick={() => setActiveView('booking')}>Đặt Lịch Trực Tuyến</a>
              </li>
              <li>
                <a onClick={() => setActiveView('albums')}>Cổng Duyệt Ảnh Online</a>
              </li>
              <li>
                <a onClick={() => setActiveView('my-bookings')}>Tra Cứu Lịch Hẹn</a>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div className="footer-col">
            <h4>Liên Hệ Studio</h4>
            <div className="footer-contact-item">
              <MapPin size={18} />
              <span>180 Cao Lỗ, Phường 4, Quận 8, TP. Hồ Chí Minh</span>
            </div>
            <div className="footer-contact-item">
              <Phone size={18} />
              <span>Hotline / Zalo: 0908 123 456</span>
            </div>
            <div className="footer-contact-item">
              <Mail size={18} />
              <span>contact@bophotostudio.vn</span>
            </div>
            <div className="footer-contact-item">
              <Clock size={18} />
              <span>Mở cửa: 08:30 - 21:00 (Hàng ngày)</span>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div>
            © 2026 Bơ Photo Studio. Nhóm 8 - Đề tài Quản lý đặt lịch studio chụp ảnh.
          </div>
          <div>
            Nền tảng: ReactJS • Node.js Express • Supabase • Vercel
          </div>
        </div>
      </div>
    </footer>
  );
}
