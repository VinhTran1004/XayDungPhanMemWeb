const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError, sendSuccess } = require('../utils/response');
const { USER_PUBLIC_FIELDS } = require('../middlewares/authMiddleware');

const registerSchema = z.object({
  ho_ten: z.string({ required_error: 'Vui lòng nhập họ tên' }).trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(120),
  email: z.string({ required_error: 'Vui lòng nhập email' }).trim().email('Email không đúng định dạng'),
  so_dien_thoai: z
    .string({ required_error: 'Vui lòng nhập số điện thoại' })
    .trim()
    .regex(/^(0|\+84)[0-9]{8,10}$/, 'Số điện thoại không hợp lệ'),
  mat_khau: z.string({ required_error: 'Vui lòng nhập mật khẩu' }).min(6, 'Mật khẩu tối thiểu 6 ký tự').max(100),
});

const loginSchema = z.object({
  email: z.string({ required_error: 'Vui lòng nhập email' }).trim().email('Email không đúng định dạng'),
  mat_khau: z.string({ required_error: 'Vui lòng nhập mật khẩu' }).min(1, 'Vui lòng nhập mật khẩu'),
});

const signAccessToken = (user) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('Hệ thống chưa cấu hình JWT_SECRET', 500, 'SERVER_CONFIG_ERROR');
  }
  return jwt.sign(
    { id: user.id, email: user.email, vai_tro: user.vai_tro },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

const stripPassword = (user) => {
  const { mat_khau: _removed, ...publicUser } = user;
  return publicUser;
};

/**
 * POST /api/auth/register
 * Register a new customer account (`vai_tro = 'khach_hang'`).
 */
const register = async (req, res, next) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const email = parsed.email.toLowerCase();

    const { data: existingUser, error: checkError } = await supabase
      .from('nguoi_dung')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (checkError) {
      throw new AppError(`Lỗi kiểm tra email: ${checkError.message}`, 500, 'DATABASE_ERROR');
    }

    if (existingUser) {
      throw new AppError('Email này đã được đăng ký', 409, 'EMAIL_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(parsed.mat_khau, 10);

    const { data: createdUser, error: insertError } = await supabase
      .from('nguoi_dung')
      .insert([
        {
          ho_ten: parsed.ho_ten,
          email,
          so_dien_thoai: parsed.so_dien_thoai,
          mat_khau: hashedPassword,
          vai_tro: 'khach_hang',
          trang_thai: true,
        },
      ])
      .select(USER_PUBLIC_FIELDS)
      .single();

    if (insertError) {
      throw new AppError(`Không thể tạo tài khoản: ${insertError.message}`, 400, 'CREATE_USER_FAILED');
    }

    const token = signAccessToken(createdUser);

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Đăng ký tài khoản thành công',
      data: {
        token,
        user: createdUser,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/auth/login
 * Authenticate user with email & password and issue a JWT.
 */
const login = async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const email = parsed.email.toLowerCase();

    const { data: user, error } = await supabase
      .from('nguoi_dung')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error) {
      throw new AppError(`Lỗi đăng nhập: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    if (!user) {
      throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    if (user.trang_thai === false) {
      throw new AppError('Tài khoản của bạn đã bị khóa', 403, 'ACCOUNT_DISABLED');
    }

    const isMatch = await bcrypt.compare(parsed.mat_khau, user.mat_khau || '');
    if (!isMatch) {
      throw new AppError('Email hoặc mật khẩu không chính xác', 401, 'INVALID_CREDENTIALS');
    }

    const publicUser = stripPassword(user);
    const token = signAccessToken(publicUser);

    return sendSuccess(res, {
      statusCode: 200,
      message: 'Đăng nhập thành công',
      data: {
        token,
        user: publicUser,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/auth/me
 * Return current authenticated user profile.
 */
const getMe = async (req, res) => {
  return sendSuccess(res, {
    statusCode: 200,
    message: 'Lấy thông tin tài khoản thành công',
    data: req.user,
  });
};

module.exports = {
  register,
  login,
  getMe,
};
