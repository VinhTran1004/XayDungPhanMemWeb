const express = require('express');
const {
  getAvailability,
  calculatePrice,
  createBooking,
  payDeposit,
  getMyBookings,
  getMyVouchers,
  getBookingDetail,
  rescheduleBooking,
  cancelBooking,
} = require('../controllers/bookingController');
const { authenticate, optionalAuthenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

// ============================================================================
// NHÓM API ĐẶT LỊCH, TÍNH GIÁ, ĐỔI LỊCH & HỦY LỊCH
// ============================================================================

// GET /api/bookings/availability?ngay_chup=YYYY-MM-DD&concept_id=1 (Public)
// -> Kiểm tra 6 ca chụp trong ngày còn trống hay không (xét đồng thời phòng chụp & số nhiếp ảnh gia rảnh, bỏ qua đơn giữ chỗ quá 15 phút)
router.get('/availability', getAvailability);

// POST /api/bookings/calculate-price (Public hoặc có Bearer Token nếu áp dụng voucher)
// -> Tính chi phí dự kiến: giá gói + dịch vụ cộng thêm - voucher => trả về tong_tien, tien_coc (30%), tien_con_lai (70%)
router.post('/calculate-price', optionalAuthenticate, calculatePrice);

// GET /api/bookings/my-bookings (Cần đăng nhập)
// -> Lấy lịch sử toàn bộ đơn đặt lịch của khách hàng đang đăng nhập (có thể lọc ?trang_thai_don=)
router.get('/my-bookings', authenticate, getMyBookings);

// GET /api/bookings/my-vouchers (Cần đăng nhập)
// -> Lấy danh sách voucher bảo lưu tiền cọc của khách hàng (kèm trạng thái còn hiệu lực hay không)
router.get('/my-vouchers', authenticate, getMyVouchers);

// POST /api/bookings (Cần đăng nhập)
// -> Tạo đơn đặt lịch mới ở trạng thái chờ cọc, tạm giữ chỗ trong 15 phút & trả về thông tin chuyển khoản/QR cọc 30%
router.post('/', authenticate, createBooking);

// GET /api/bookings/:id (Cần đăng nhập - chủ đơn hoặc Admin)
// -> Lấy chi tiết 1 đơn đặt lịch kèm dịch vụ thêm, lịch sử thanh toán và thông tin QR cọc (nếu đang chờ cọc)
router.get('/:id', authenticate, getBookingDetail);

// POST /api/bookings/:id/pay-deposit (Cần đăng nhập - chủ đơn hoặc Admin)
// -> Xác nhận đã thanh toán tiền cọc 30% trong thời hạn giữ chỗ 15 phút, chuyển đơn sang trạng thái 'da_coc'
router.post('/:id/pay-deposit', authenticate, payDeposit);

// PATCH /api/bookings/:id/reschedule (Cần đăng nhập - chủ đơn)
// -> Đổi ngày/giờ chụp miễn phí tối đa 1 lần (chỉ cho phép khi trước giờ chụp >= 24 giờ và slot mới còn trống)
router.patch('/:id/reschedule', authenticate, rescheduleBooking);

// PATCH /api/bookings/:id/cancel (Cần đăng nhập - chủ đơn)
// -> Hủy đơn đặt lịch: >= 48h được chọn voucher bảo lưu 100% cọc (6 tháng) hoặc hoàn 50%; < 48h mất 100% cọc
router.patch('/:id/cancel', authenticate, cancelBooking);

module.exports = router;
