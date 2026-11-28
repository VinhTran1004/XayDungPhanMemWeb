const express = require('express');
const {
  getAdminBookings,
  getAdminBookingDetail,
  createAdminBooking,
  updateAdminBooking,
  deleteAdminBooking,
  getPhotographers,
  confirmDeposit,
  assignPhotographer,
  updateBookingStatus,
  confirmFinalPayment,
  uploadRawPhotos,
  uploadFinalPhotos,
  listAdminPayments,
  deleteAdminPayment,
  getActivityLogs,
  getStats,
} = require('../controllers/adminController');
const {
  listCatalogItems,
  getCatalogItemDetail,
  createCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
  listUsers,
  getUserDetail,
  createUser,
  updateUser,
  deleteUser,
  listAdminAlbums,
  getAdminAlbumDetail,
  createAdminAlbum,
  updateAdminAlbum,
  deleteAdminAlbum,
  deleteAdminAlbumPhoto,
  listAdminVouchers,
  createAdminVoucher,
  updateAdminVoucher,
  deleteAdminVoucher,
} = require('../controllers/adminCrudController');
const { authenticate, requireRole } = require('../middlewares/authMiddleware');
const { uploadPhotos } = require('../middlewares/uploadMiddleware');

const router = express.Router();

// ============================================================================
// NHÓM API DASHBOARD QUẢN TRỊ TOÀN DIỆN (CHỈ DÀNH CHO ADMIN: 'quan_tri_vien')
// ============================================================================
router.use(authenticate, requireRole('quan_tri_vien'));

// --- 1. THỐNG KÊ, LỊCH SỬ GIAO DỊCH & NHẬT KÝ HOẠT ĐỘNG ---
// GET /api/admin/stats -> Thống kê doanh thu, doanh thu theo tháng, số đơn theo trạng thái/phòng/gói
router.get('/stats', getStats);

// GET /api/admin/activity-logs -> Dòng thời gian nhật ký hoạt động mới nhất toàn studio
router.get('/activity-logs', getActivityLogs);

// GET & DELETE /api/admin/payments -> Xem & xóa bản ghi lịch sử giao dịch thanh toán
router.get('/payments', listAdminPayments);
router.delete('/payments/:id', deleteAdminPayment);

// --- 2. CRUD ĐƠN ĐẶT LỊCH & NGHIỆP VỤ XỬ LÝ ĐƠN (/api/admin/bookings) ---
// GET /api/admin/bookings -> Danh sách tất cả đơn đặt lịch (kèm bộ lọc & phân trang)
// POST /api/admin/bookings -> Admin tạo mới đơn đặt lịch trực tiếp cho khách tại quầy
router.get('/bookings', getAdminBookings);
router.post('/bookings', createAdminBooking);

// GET / PATCH / PUT / DELETE /api/admin/bookings/:id -> Xem chi tiết, chỉnh sửa, hủy/xóa đơn (?hard=true để xóa hẳn)
router.get('/bookings/:id', getAdminBookingDetail);
router.patch('/bookings/:id', updateAdminBooking);
router.put('/bookings/:id', updateAdminBooking);
router.delete('/bookings/:id', deleteAdminBooking);

// Nghiệp vụ vận hành đơn đặt lịch
router.patch('/bookings/:id/confirm-deposit', confirmDeposit);
router.patch('/bookings/:id/assign-photographer', assignPhotographer);
router.patch('/bookings/:id/status', updateBookingStatus);
router.patch('/bookings/:id/final-payment', confirmFinalPayment);

// --- 3. CRUD NGƯỜI DÙNG & NHIẾP ẢNH GIA (/api/admin/users & /photographers) ---
// Quản lý toàn bộ tài khoản (khách hàng, thợ chụp, quản trị viên)
router.get('/users', listUsers);
router.post('/users', createUser());
router.get('/users/:id', getUserDetail);
router.patch('/users/:id', updateUser);
router.put('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

// Endpoint chuyên biệt cho Nhiếp ảnh gia (tự động gán vai_tro = 'tho_chup' khi tạo mới)
router.get('/photographers', getPhotographers);
router.post('/photographers', createUser('tho_chup'));
router.patch('/photographers/:id', updateUser);
router.put('/photographers/:id', updateUser);
router.delete('/photographers/:id', deleteUser);

// --- 4. CRUD ALBUM & QUẢN LÝ ẢNH DUYỆT (/api/admin/albums) ---
router.get('/albums', listAdminAlbums);
router.post('/albums', createAdminAlbum);
router.get('/albums/:id', getAdminAlbumDetail);
router.patch('/albums/:id', updateAdminAlbum);
router.put('/albums/:id', updateAdminAlbum);
router.delete('/albums/:id', deleteAdminAlbum);

// Upload ảnh thô, ảnh hoàn thiện và xóa từng tấm ảnh lẻ trong album
router.post('/albums/:donDatLichId/raw-photos', uploadPhotos.array('photos', 100), uploadRawPhotos);
router.post('/albums/:albumId/final-photos', uploadPhotos.array('photos', 100), uploadFinalPhotos);
router.delete('/albums/:albumId/photos/:photoId', deleteAdminAlbumPhoto);

// --- 5. CRUD VOUCHER (/api/admin/vouchers) ---
router.get('/vouchers', listAdminVouchers);
router.post('/vouchers', createAdminVoucher);
router.patch('/vouchers/:id', updateAdminVoucher);
router.put('/vouchers/:id', updateAdminVoucher);
router.delete('/vouchers/:id', deleteAdminVoucher);

// --- 6. CRUD DANH MỤC SẢN PHẨM (/api/admin/catalog/:resource) ---
// `resource` hỗ trợ: categories | concepts | packages | addons | rooms | time-slots
router.get('/catalog/:resource', listCatalogItems);
router.post('/catalog/:resource', createCatalogItem);
router.get('/catalog/:resource/:id', getCatalogItemDetail);
router.patch('/catalog/:resource/:id', updateCatalogItem);
router.put('/catalog/:resource/:id', updateCatalogItem);
router.delete('/catalog/:resource/:id', deleteCatalogItem);

module.exports = router;
