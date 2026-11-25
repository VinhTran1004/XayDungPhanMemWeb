const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// Cho phép React gọi sang backend (CORS)
app.use(cors());

// Parse JSON body từ request
app.use(express.json());

// Gắn toàn bộ router API vào tiền tố /api
app.use('/api', apiRoutes);

// Xử lý route không tồn tại & lỗi tập trung
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Backend Node.js server đang chạy tại: http://localhost:${PORT}`);
    console.log(`👉 Kiểm tra API tại: http://localhost:${PORT}/api/health`);
  });
}

module.exports = app;
