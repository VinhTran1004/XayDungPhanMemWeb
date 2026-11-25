const express = require('express');
const {
  getAdminBookings,
  getPhotographers,
  confirmDeposit,
  assignPhotographer,
  updateBookingStatus,
  confirmFinalPayment,
  uploadRawPhotos,
  uploadFinalPhotos,
  getStats,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} = require('../controllers/adminController');
const { authenticate, requireRole } = require('../middlewares/authMiddleware');
const { uploadPhotos } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// ============================================================================
// NHÓM API DASHBOARD QUẢN TRỊ (CHỈ DÀNH CHO ADMIN: vai_tro = 'quan_tri_vien')
// ============================================================================
router.use(authenticate, requireRole('quan_tri_vien'));

// GET /api/admin/bookings?ngay_chup=&phong_chup_id=&tho_chup_id=&trang_thai_don=&trang_thai_thanh_toan=&ma_don=&page=&limit=
// -> Lấy danh sách toàn bộ đơn đặt lịch trong hệ thống kèm bộ lọc & phân trang
router.get('/bookings', getAdminBookings);

// GET /api/admin/photographers
// -> Lấy danh sách tất cả nhiếp ảnh gia (`vai_tro = 'tho_chup'`) để Admin chọn gán ca chụp
router.get('/photographers', getPhotographers);

// PATCH /api/admin/bookings/:id/confirm-deposit
// -> Admin xác nhận đã nhận tiền cọc 30% chuyển khoản/tiền mặt cho đơn 'cho_thanh_toan_coc'
router.patch('/bookings/:id/confirm-deposit', confirmDeposit);

// PATCH /api/admin/bookings/:id/assign-photographer
// -> Admin gán nhiếp ảnh gia (`tho_chup_id`) cho đơn đặt lịch (tự động kiểm tra thợ không bị trùng ca khác)
router.patch('/bookings/:id/assign-photographer', assignPhotographer);

// PATCH /api/admin/bookings/:id/status
// -> Admin cập nhật trạng thái đơn (`dang_chup`, `cho_chon_anh`, `hoan_thanh`, `da_huy_mat_coc`...) và ghi chú nội bộ
router.patch('/bookings/:id/status', updateBookingStatus);

// PATCH /api/admin/bookings/:id/final-payment
// -> Admin xác nhận khách đã tất toán 70% còn lại (+ phụ phí ảnh thêm nếu có) tại quầy
router.patch('/bookings/:id/final-payment', confirmFinalPayment);

// POST /api/admin/albums/:donDatLichId/raw-photos
// -> Admin tải lên hàng loạt ảnh chụp thô (multipart field `photos` tối đa 100 ảnh hoặc `photo_urls`), tạo album và mở cổng duyệt ảnh
router.post('/albums/:donDatLichId/raw-photos', uploadPhotos.array('photos', 100), uploadRawPhotos);

// POST /api/admin/albums/:albumId/final-photos
// -> Admin tải lên ảnh đã chỉnh sửa hoàn thiện để bàn giao cho khách hàng (`da_ban_giao`)
router.post('/albums/:albumId/final-photos', uploadPhotos.array('photos', 100), uploadFinalPhotos);

// GET /api/admin/stats
// -> Lấy số liệu thống kê cho Dashboard Admin: tổng doanh thu, tổng đơn, số đơn theo trạng thái & theo phòng chụp
router.get('/stats', getStats);

// POST / PATCH / DELETE /api/admin/catalog/:resource (/:id)
// -> Quản trị CRUD danh mục sản phẩm (`resource` nhận: categories | concepts | packages | addons | rooms)
router.post('/catalog/:resource', createCatalogItem);
router.patch('/catalog/:resource/:id', updateCatalogItem);
router.delete('/catalog/:resource/:id', deleteCatalogItem);

module.exports = router;
