const multer = require('multer');
const { AppError } = require('../utils/response');

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per photo
    files: 100,
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new AppError(`Định dạng tệp ${file.mimetype} không được hỗ trợ (chỉ nhận JPG, PNG, WEBP)`, 400, 'INVALID_FILE_TYPE'));
    }
    return cb(null, true);
  },
});

module.exports = {
  uploadPhotos,
};
