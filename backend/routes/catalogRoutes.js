const express = require('express');
const {
  getHomeData,
  getCategories,
  getConcepts,
  getConceptDetail,
  getPackages,
  getAddons,
  getTimeSlots,
  getRooms,
  getPublicPhotographers,
} = require('../controllers/catalogController');

const router = express.Router();

// ============================================================================
// NHÓM API SẢN PHẨM & DANH MỤC STUDIO (PUBLIC - KHÔNG CẦN ĐĂNG NHẬP)
// Dùng cho Frontend hiển thị Trang chủ, Portfolio Concept, Bảng giá & Không gian
// ============================================================================

// GET /api/catalog/home
// -> Lấy trọn bộ dữ liệu Trang chủ trong 1 lần gọi: danh mục (kèm số lượng concept), concept nổi bật, 3 gói chụp, 3 phòng chụp
router.get('/home', getHomeData);

// GET /api/catalog/categories?include_concepts=true
// -> Lấy danh sách danh mục dịch vụ (Cá nhân, Cặp đôi, Sinh nhật...) kèm số lượng concept; thêm ?include_concepts=true để lấy kèm mảng concept con
router.get('/categories', getCategories);

// GET /api/catalog/concepts?danh_muc_id=&duong_dan_danh_muc=&phong_chup_id=&q=&page=&limit=
// -> Lấy danh sách concept nghệ thuật; hỗ trợ lọc theo danh mục, phòng chụp, tìm kiếm từ khóa (?q=), và phân trang (?page=&limit=)
router.get('/concepts', getConcepts);

// GET /api/catalog/concepts/:slugOrId
// -> Lấy chi tiết 1 concept (ảnh mẫu, gợi ý trang phục, phòng chụp) + tối đa 4 concept liên quan + danh sách gói chụp
router.get('/concepts/:slugOrId', getConceptDetail);

// GET /api/catalog/packages
// -> Lấy bảng 3 gói quy mô (Basic, Standard, VIP) gồm giá, thời lượng, số ảnh chỉnh sửa, số trang phục tối đa
router.get('/packages', getPackages);

// GET /api/catalog/addons
// -> Lấy danh sách dịch vụ cộng thêm (Trang điểm & tóc, thêm người, file gốc, photobook...)
router.get('/addons', getAddons);

// GET /api/catalog/time-slots
// -> Lấy 6 khung giờ chụp cố định trong ngày (08:30 - 21:00)
router.get('/time-slots', getTimeSlots);

// GET /api/catalog/rooms
// -> Lấy danh sách 3 phòng chụp vật lý và phong cách từng phòng
router.get('/rooms', getRooms);

// GET /api/catalog/photographers
// -> Lấy danh sách công khai đội ngũ nhiếp ảnh gia (chỉ trả id, ho_ten, anh_dai_dien)
router.get('/photographers', getPublicPhotographers);

module.exports = router;
