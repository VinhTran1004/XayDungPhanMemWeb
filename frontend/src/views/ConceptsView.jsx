import React, { useState, useEffect } from 'react';
import { catalogApi } from '../api/client';
import { Search, Filter, Sparkles, Calendar, Maximize2, Layers } from 'lucide-react';

export default function ConceptsView({ onSelectConcept, onOpenConceptDetail }) {
  const [concepts, setConcepts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRoom, setSelectedRoom] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [conceptsRes, catRes, roomsRes] = await Promise.all([
          catalogApi.getConcepts(),
          catalogApi.getCategories(),
          catalogApi.getRooms(),
        ]);

        if (conceptsRes.success && conceptsRes.data) {
          setConcepts(Array.isArray(conceptsRes.data) ? conceptsRes.data : []);
        }
        if (catRes.success && catRes.data) {
          setCategories(Array.isArray(catRes.data) ? catRes.data : []);
        }
        if (roomsRes.success && roomsRes.data) {
          setRooms(Array.isArray(roomsRes.data) ? roomsRes.data : []);
        }
      } catch (err) {
        console.error('Lỗi tải danh sách concept:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Filter logic
  const filteredConcepts = (Array.isArray(concepts) ? concepts : []).filter((c) => {
    const matchCat =
      selectedCategory === 'all' ||
      c.danh_muc_id === Number(selectedCategory) ||
      c.danh_muc_dich_vu?.id === Number(selectedCategory);

    const matchRoom =
      selectedRoom === 'all' ||
      c.phong_chup_id === Number(selectedRoom) ||
      c.phong_chup?.id === Number(selectedRoom);

    const matchSearch =
      !searchQuery ||
      c.ten_concept.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.mo_ta && c.mo_ta.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchCat && matchRoom && matchSearch;
  });

  return (
    <div className="container section-padding">
      <div className="section-header text-center">
        <div className="badge badge-gold">Bộ Sưu Tập Studio</div>
        <h1 className="section-title font-serif">Concept Chụp Ảnh & Portfolio</h1>
        <p className="section-subtitle">
          Khám phá các phong cách chụp ảnh nghệ thuật được thiết kế độc quyền bởi các Stylist & Photographer chuyên nghiệp.
        </p>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="catalog-filters-bar">
        {/* Search */}
        <div className="filter-search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm kiếm tên concept, phong cách..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Categories Pills */}
        <div className="filter-pills-row">
          <button
            className={`filter-pill ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            Tất Cả Thể Loại
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`filter-pill ${selectedCategory === String(cat.id) ? 'active' : ''}`}
              onClick={() => setSelectedCategory(String(cat.id))}
            >
              {cat.ten_danh_muc}
            </button>
          ))}
        </div>

        {/* Room select */}
        <div className="filter-dropdown-wrapper">
          <select
            className="filter-select"
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
          >
            <option value="all">Tất Cả Phòng Chụp</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.ten_phong}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CONCEPTS LIST */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner-inline"></div>
          <p>Đang tải danh sách concept...</p>
        </div>
      ) : filteredConcepts.length === 0 ? (
        <div className="empty-state">
          <p>Không tìm thấy concept nào phù hợp với bộ lọc hiện tại.</p>
          <button
            className="btn-secondary"
            onClick={() => {
              setSelectedCategory('all');
              setSelectedRoom('all');
              setSearchQuery('');
            }}
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="concepts-grid">
          {filteredConcepts.map((concept) => (
            <div key={concept.id} className="concept-card">
              <div className="concept-img-wrapper">
                <img
                  src={concept.hinh_dai_dien}
                  alt={concept.ten_concept}
                  className="concept-img"
                />
                <div className="concept-overlay-actions">
                  <button
                    className="btn-icon-blur"
                    title="Xem chi tiết bộ ảnh mẫu"
                    onClick={() => onOpenConceptDetail(concept)}
                  >
                    <Maximize2 size={18} />
                  </button>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => onSelectConcept(concept)}
                  >
                    <Calendar size={14} /> Đặt Lịch
                  </button>
                </div>
                {concept.phong_chup && (
                  <div className="concept-room-tag">
                    {concept.phong_chup.ten_phong.split(' - ')[0]}
                  </div>
                )}
              </div>

              <div className="concept-info">
                <div className="concept-category-badge">
                  {concept.danh_muc_dich_vu?.ten_danh_muc || 'Concept Nghệ Thuật'}
                </div>
                <h3
                  className="concept-title font-serif"
                  onClick={() => onOpenConceptDetail(concept)}
                >
                  {concept.ten_concept}
                </h3>
                <p className="concept-summary">{concept.mo_ta}</p>
                {concept.goi_y_trang_phuc && (
                  <div className="concept-outfit">
                    <span>Trang phục gợi ý:</span> {concept.goi_y_trang_phuc}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
