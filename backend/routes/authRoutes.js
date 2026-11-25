const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');

const router = express.Router();

// ============================================================================
// NHÓM API XÁC THỰC TÀI KHOẢN (AUTH)
// ============================================================================

// POST /api/auth/register
// -> Đăng ký tài khoản khách hàng mới (vai_tro = 'khach_hang'), trả về JWT token + thông tin user
router.post('/register', register);

// POST /api/auth/login
// -> Đăng nhập bằng email & mật khẩu, trả về JWT token + thông tin user (chứa vai_tro để Frontend điều hướng)
router.post('/login', login);

// GET /api/auth/me (Cần Bearer Token)
// -> Lấy thông tin hồ sơ người dùng đang đăng nhập từ JWT token
router.get('/me', authenticate, getMe);

module.exports = router;
