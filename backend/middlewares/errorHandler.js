const multer = require('multer');
const { ZodError } = require('zod');
const { AppError } = require('../utils/response');

/**
 * Handle unmatched API routes with a standardized 404 response.
 */
const notFoundHandler = (req, res, next) => {
  next(new AppError(`Không tìm thấy đường dẫn: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
};

/**
 * Global Express error-handling middleware.
 */
const errorHandler = (err, req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      errorCode: 'UPLOAD_ERROR',
      message: err.code === 'LIMIT_FILE_SIZE' ? 'Kích thước ảnh vượt quá giới hạn 20MB' : `Lỗi tải tệp lên: ${err.message}`,
    });
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      message: errors[0]?.message || 'Dữ liệu gửi lên không hợp lệ',
      errors,
    });
  }

  if (err instanceof AppError) {
    const response = {
      success: false,
      errorCode: err.errorCode,
      message: err.message,
    };
    if (err.details) {
      response.details = err.details;
    }
    return res.status(err.statusCode).json(response);
  }

  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      errorCode: 'INVALID_JSON',
      message: 'Body JSON không đúng định dạng',
    });
  }

  console.error('❌ Unhandled Error:', err);
  return res.status(500).json({
    success: false,
    errorCode: 'INTERNAL_SERVER_ERROR',
    message: 'Lỗi hệ thống nội bộ, vui lòng thử lại sau',
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
