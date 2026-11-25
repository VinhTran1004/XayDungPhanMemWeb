const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/response');

const USER_PUBLIC_FIELDS = 'id, ho_ten, email, so_dien_thoai, vai_tro, anh_dai_dien, trang_thai, ngay_tao';

/**
 * Verify Bearer JWT and attach active user record from `nguoi_dung` to `req.user`.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      throw new AppError('Vui lòng đăng nhập để tiếp tục', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw new AppError('Token xác thực không hợp lệ', 401, 'INVALID_TOKEN');
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new AppError('Hệ thống chưa cấu hình JWT_SECRET', 500, 'SERVER_CONFIG_ERROR');
    }

    let decoded;
    try {
      decoded = jwt.verify(token, jwtSecret);
    } catch (err) {
      const isExpired = err.name === 'TokenExpiredError';
      throw new AppError(
        isExpired ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' : 'Token xác thực không hợp lệ',
        401,
        isExpired ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
      );
    }

    const { data: user, error } = await supabase
      .from('nguoi_dung')
      .select(USER_PUBLIC_FIELDS)
      .eq('id', decoded.id)
      .maybeSingle();

    if (error) {
      throw new AppError(`Lỗi xác thực người dùng: ${error.message}`, 500, 'DATABASE_ERROR');
    }

    if (!user) {
      throw new AppError('Tài khoản không tồn tại', 401, 'USER_NOT_FOUND');
    }

    if (user.trang_thai === false) {
      throw new AppError('Tài khoản của bạn đã bị khóa', 403, 'ACCOUNT_DISABLED');
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Optionally verify Bearer JWT if present; continues with `req.user = null` if omitted.
 */
const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  return authenticate(req, res, next);
};

/**
 * Restrict route access to one or more `vai_tro` roles.
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Vui lòng đăng nhập để tiếp tục', 401, 'UNAUTHORIZED'));
  }
  if (!allowedRoles.includes(req.user.vai_tro)) {
    return next(new AppError('Bạn không có quyền thực hiện thao tác này', 403, 'FORBIDDEN'));
  }
  return next();
};

module.exports = {
  authenticate,
  optionalAuthenticate,
  requireRole,
  USER_PUBLIC_FIELDS,
};
