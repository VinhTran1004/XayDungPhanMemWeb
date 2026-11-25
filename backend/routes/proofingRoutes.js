const express = require('express');
const {
  getMyAlbums,
  getAlbumByBooking,
  updatePhotoSelection,
  submitAlbumSelection,
  downloadFinalAlbum,
} = require('../controllers/proofingController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

// ============================================================================
// NHÓM API CỔNG DUYỆT ẢNH TRỰC TUYẾN (CLIENT PROOFING PORTAL)
// Toàn bộ yêu cầu đăng nhập và chỉ chủ sở hữu đơn hàng (hoặc Admin) mới truy cập được
// ============================================================================
router.use(authenticate);

// GET /api/albums/my-albums
// -> Lấy danh sách tất cả album ảnh thuộc các đơn đặt lịch của khách hàng đang đăng nhập
router.get('/my-albums', getMyAlbums);

// GET /api/albums/:donDatLichId
// -> Lấy chi tiết album và danh sách ảnh thô/hoàn thiện (kèm Signed URL bảo mật, số ảnh đã chọn & phụ phí ảnh thêm)
router.get('/:donDatLichId', getAlbumByBooking);

// PATCH /api/albums/:albumId/photos/:photoId
// -> Khách tick chọn/bỏ chọn 1 tấm ảnh (`duoc_chon`) và nhập ghi chú chỉnh sửa (`ghi_chu_khach`), trả về thống kê phụ phí real-time
router.patch('/:albumId/photos/:photoId', updatePhotoSelection);

// POST /api/albums/:albumId/submit
// -> Khách bấm "Xác nhận gửi chỉnh sửa": khóa danh sách chọn ảnh, cộng phụ phí ảnh thêm (50.000đ/ảnh vượt gói) nếu có
router.post('/:albumId/submit', submitAlbumSelection);

// GET /api/albums/:albumId/download
// -> Lấy danh sách link tải độ phân giải gốc (Signed URL) cho toàn bộ ảnh đã hoàn thiện khi album ở trạng thái 'da_ban_giao'
router.get('/:albumId/download', downloadFinalAlbum);

module.exports = router;
