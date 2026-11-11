const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes/api');

const app = express();

// Cho phép React gọi sang backend (CORS)
app.use(cors());

// Parse JSON body từ request
app.use(express.json());

// Gắn toàn bộ router API vào tiền tố /api
app.use('/api', apiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Backend Node.js server đang chạy tại: http://localhost:${PORT}`);
  console.log(`👉 Kiểm tra API tại: http://localhost:${PORT}/api/health`);
});

