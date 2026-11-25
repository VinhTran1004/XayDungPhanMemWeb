/**
 * Custom application error carrying HTTP status and machine-readable errorCode.
 */
class AppError extends Error {
  constructor(message, statusCode = 400, errorCode = 'BAD_REQUEST', details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

/**
 * Send a standardized JSON success response.
 */
const sendSuccess = (res, { statusCode = 200, message = 'Thành công', data = null, meta = null } = {}) => {
  const payload = {
    success: true,
    message,
    data,
  };
  if (meta !== null) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
};

module.exports = {
  AppError,
  sendSuccess,
};
