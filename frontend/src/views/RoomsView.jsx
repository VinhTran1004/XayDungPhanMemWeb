import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/client';
import { DoorOpen, Sparkles, Lightbulb, Users, Calendar } from 'lucide-react';

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

  const roomImages = {
    1: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?auto=format&fit=crop&w=800&q=80',
    2: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
    3: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=800&q=80',
  };

  return (
    <div className="container section-padding">
      <div className="section-header text-center">
        <div className="badge badge-gold">Không Gian Studio Đẳng Cấp</div>
        <h1 className="section-title font-serif">03 Phòng Chụp Chuyên Biệt</h1>
        <p className="section-subtitle">
          Được trang bị hệ thống dàn đèn Godox / Profoto, phông nền phong phú và bối cảnh decor chuẩn studio cao cấp.
        </p>
      </div>

      <div className="rooms-detail-grid">
        {rooms.map((room) => (
          <div key={room.id} className="room-detail-card">
            <div className="room-image-box">
              <img
                src={roomImages[room.id] || roomImages[1]}
                alt={room.ten_phong}
              />
              <div className="room-badge-overlay">
                PHÒNG 0{room.id}
              </div>
            </div>

            <div className="room-detail-body">
              <h3 className="room-title font-serif">{room.ten_phong}</h3>
              <div className="badge badge-gold" style={{ marginBottom: '12px' }}>
                <Sparkles size={14} /> {room.phong_cach}
              </div>
              <p className="room-text">{room.mo_ta}</p>

              <div className="room-features-box">
                <div className="room-feat">
                  <Lightbulb size={16} /> Dàn đèn Softbox & Đèn rọi chuyên nghiệp
                </div>
                <div className="room-feat">
                  <DoorOpen size={16} /> Điều hòa 2 chiều & Phòng thay đồ riêng
                </div>
                <div className="room-feat">
                  <Users size={16} /> Sức chứa: 1 - 8 người/ca chụp
                </div>
              </div>

              <button
                className="btn-primary btn-block"
                onClick={() => setActiveView('booking')}
              >
                <Calendar size={16} /> Đặt Lịch Chụp Phòng Này
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
