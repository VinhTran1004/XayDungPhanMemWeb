import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/client';
import {
  Sparkles,
  Lightbulb,
  Users,
  Calendar,
  Maximize2,
  Palette,
  Wind,
  ShieldCheck,
  Coffee,
  Car,
  Layers,
  ArrowRight,
  CheckCircle,
} from 'lucide-react';

export default function RoomsView({ setActiveView }) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchRooms() {
      try {
        const res = await catalogApi.getRooms();
        if (res.success && res.data) {
          setRooms(Array.isArray(res.data) ? res.data : []);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách phòng:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, []);

  // Rich metadata cho từng phòng chụp chuẩn studio cao cấp
  const roomMetaConfig = {
    1: {
      name: 'Phòng 01 — Minimalist & Business Editorial',
      tagline: 'Tối Giản Hiện Đại & Chuẩn Mực Tạp Chí',
      heroImage:
        'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=1200&q=85',
      thumbnails: [
        'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1520333789090-1afc82db536a?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=400&q=80',
      ],
      specs: [
        { label: 'Diện tích', value: '55m² sàn bê tông mỹ thuật & trần cao 3.8m' },
        { label: 'Hệ thống đèn', value: '03 đèn Godox QT600II + Softbox bát giác 120cm & Parabolic' },
        { label: 'Phông nền', value: 'Phông cuốn vô cực 4 màu: Trắng tinh, Đen tuyền, Xám xi măng, Be cát' },
        { label: 'Tiện nghi riêng', value: 'Bàn makeup gương đèn LED chuẩn màu, máy là hơi nước đứng' },
        { label: 'Sức chứa', value: '1 - 6 người (Thoải mái cho chụp cá nhân, đôi & profile)' },
        { label: 'Điều hòa & âm thanh', value: 'Điều hòa Daikin 2 chiều âm trần & loa Marshall Acton' },
      ],
      concepts: [
        'Trắng Đen Tối Giản',
        'Profile Doanh Nhân & Brand Cá Nhân',
        'Beauty Chân Dung Nghệ Thuật',
        'Thời Trang Lookbook Tối Giản',
      ],
    },
    2: {
      name: 'Phòng 02 — Dreamy Floral & Soft Light Garden',
      tagline: 'Mộng Mơ Tự Nhiên & Nàng Thơ Lãng Mạn',
      heroImage:
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=85',
      thumbnails: [
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1469371670807-013ccf25f16a?auto=format&fit=crop&w=400&q=80',
      ],
      specs: [
        { label: 'Diện tích', value: '65m² đón trọn vẹn ánh sáng tự nhiên qua cửa kính vòm lớn' },
        { label: 'Hệ thống đèn', value: 'Profoto D2 ánh sáng tản mềm (Diffuser 150cm) & đèn Godox SL150W' },
        { label: 'Phông nền & Decor', value: 'Bối cảnh hoa tươi nghệ thuật, rèm voan lụa trắng & thảm len vintage' },
        { label: 'Tiện nghi riêng', value: 'Góc makeup cổ điển, hoa cầm tay và giỏ mây đạo cụ đa dạng' },
        { label: 'Sức chứa', value: '1 - 8 người (Lý tưởng cho nàng thơ, couple & kỷ yếu bạn thân)' },
        { label: 'Điều hòa & âm thanh', value: 'Không gian thơm tinh dầu hoa oải hương & máy lạnh riêng biệt' },
      ],
      concepts: [
        'Nàng Thơ Vườn Hoa',
        'Cặp Đôi Vintage Lãng Mạn',
        'Kỷ Yếu Tốt Nghiệp Thanh Xuân',
        'Mẹ & Bé Yêu Thương',
      ],
    },
    3: {
      name: 'Phòng 03 — Creative & Y2K Color Pop',
      tagline: 'Sáng Tạo Phá Cách & Ánh Sáng RGB Đa Sắc',
      heroImage:
        'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=85',
      thumbnails: [
        'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=400&q=80',
      ],
      specs: [
        { label: 'Diện tích', value: '50m² trang bị hệ thống rèm nhung & tường màu pastel cá tính' },
        { label: 'Hệ thống đèn', value: 'Dàn đèn LED RGB đổi 16 triệu màu + đèn rọi tổ ong & gel màu nghệ thuật' },
        { label: 'Phông nền & Decor', value: 'Phông tương phản (Xanh bơ, Hồng kẹo, Vàng mustard) & đạo cụ retro' },
        { label: 'Hiệu ứng đặc biệt', value: 'Máy tạo khói sân khấu mini & quạt gió tạo hiệu ứng tóc bay' },
        { label: 'Sức chứa', value: '1 - 8 người (Thoải mái tạo dáng nhóm bạn & phong cách streetwear)' },
        { label: 'Điều hòa & âm thanh', value: 'Điều hòa 2 chiều công suất lớn & hệ thống âm thanh sôi động' },
      ],
      concepts: [
        'Cá Tính Y2K Nổi Loạn',
        'Cyberpunk Ánh Sáng Neon',
        'Thời Trang High-Streetwear',
        'Nhóm Bạn Besties Phá Cách',
      ],
    },
  };

  return (
    <div className="container section-padding">
      {/* SECTION HEADER */}
      <div className="section-header text-center">
        <div className="badge badge-gold">Không Gian Nghệ Thuật & Ánh Sáng</div>
        <h1 className="section-title font-serif">03 Không Gian Phòng Chụp Studio</h1>
        <p className="section-subtitle">
          Được thiết kế kiến trúc và phong cách riêng biệt, trang bị 100% điều hòa âm trần và hệ thống ánh sáng chuyên nghiệp Godox / Profoto.
        </p>
      </div>

      {/* ROOMS SHOWCASE LIST */}
      <div className="rooms-editorial-list">
        {rooms.map((room) => {
          const meta = roomMetaConfig[room.id] || roomMetaConfig[1];
          return (
            <div key={room.id} className="room-editorial-card">
              {/* Cột ảnh phòng */}
              <div className="room-editorial-gallery">
                <div className="room-editorial-hero">
                  <img src={meta.heroImage} alt={room.ten_phong} />
                  <div className="room-editorial-badge">PHÒNG 0{room.id}</div>
                  <div className="room-tagline-overlay">{meta.tagline}</div>
                </div>

                <div className="room-thumbnail-row">
                  {meta.thumbnails.map((thumb, idx) => (
                    <div key={idx} className="room-thumb-item">
                      <img src={thumb} alt={`Góc chụp ${idx + 1}`} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Cột thông tin chi tiết */}
              <div className="room-editorial-info">
                <div className="room-header-meta">
                  <span className="badge badge-gold">
                    <Sparkles size={14} /> {room.phong_cach}
                  </span>
                  <span className="room-code-tag">BO-STUDIO-RM{room.id}</span>
                </div>

                <h2 className="room-title font-serif">{meta.name}</h2>
                <p className="room-desc-text">{room.mo_ta}</p>

                {/* Thông số kỹ thuật phòng */}
                <div className="room-specs-grid">
                  {meta.specs.map((spec, sIdx) => (
                    <div key={sIdx} className="spec-item">
                      <div className="spec-item-icon">
                        <CheckCircle size={15} />
                      </div>
                      <div className="spec-item-content">
                        <span className="spec-label">{spec.label}:</span>{' '}
                        <span className="spec-val">{spec.value}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Concept phù hợp */}
                <div className="room-concepts-box">
                  <div className="concepts-box-title">
                    <Palette size={15} /> Concept tiêu biểu phù hợp phòng này:
                  </div>
                  <div className="concept-tags-row">
                    {meta.concepts.map((c, cIdx) => (
                      <span key={cIdx} className="concept-pill-chip">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Hành động */}
                <div className="room-editorial-actions">
                  <button
                    className="btn-primary"
                    onClick={() => setActiveView('booking')}
                  >
                    <Calendar size={16} /> Đặt Lịch Chụp Phòng Này
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => setActiveView('concepts')}
                  >
                    Xem Tất Cả Concept <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* STUDIO AMENITIES & INFRASTRUCTURE */}
      <div className="studio-amenities-section">
        <div className="section-header text-center">
          <div className="badge badge-gold">Hạ Tầng Đạt Chuẩn</div>
          <h2 className="section-title font-serif">Tiện Nghi & Cơ Sở Vật Chất Studio</h2>
          <p className="section-subtitle">
            Mọi góc nhỏ tại Bơ Photo Studio đều được chăm chút tỉ mỉ mang lại sự thoải mái nhất cho khách hàng
          </p>
        </div>

        <div className="amenities-grid">
          <div className="amenity-card">
            <div className="amenity-icon">
              <Wind size={26} />
            </div>
            <h3>100% Điều Hòa Âm Trần</h3>
            <p>
              Hệ thống máy lạnh âm trần 2 chiều công suất lớn đảm bảo không gian luôn mát mẻ, khô ráo trong suốt buổi chụp.
            </p>
          </div>

          <div className="amenity-card">
            <div className="amenity-icon">
              <Sparkles size={26} />
            </div>
            <h3>Phòng Makeup & Thay Đồ Riêng</h3>
            <p>
              Bàn trang điểm gương đèn LED 5500K chuẩn màu, máy sấy tóc Dyson và bàn ủi hơi nước đứng chuyên dụng.
            </p>
          </div>

          <div className="amenity-card">
            <div className="amenity-icon">
              <Coffee size={26} />
            </div>
            <h3>Lounge Chờ & Trà Bánh Miễn Phí</h3>
            <p>
              Sofa êm ái, wifi tốc độ cao, nhạc nền nhẹ nhàng cùng trà bánh và nước khoáng phục vụ miễn phí cho khách và người thân.
            </p>
          </div>

          <div className="amenity-card">
            <div className="amenity-icon">
              <Car size={26} />
            </div>
            <h3>Bãi Đậu Xe Ô Tô & Xe Máy An Ninh</h3>
            <p>
              Mặt tiền rộng rãi, đỗ ô tô và xe máy thuận tiện có bảo vệ túc trực 24/7 an tâm tuyệt đối.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
