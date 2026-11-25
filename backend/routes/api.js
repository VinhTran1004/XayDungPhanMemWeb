const express = require('express');
const supabase = require('../config/supabase');
const authRoutes = require('./authRoutes');
const catalogRoutes = require('./catalogRoutes');
const bookingRoutes = require('./bookingRoutes');
const proofingRoutes = require('./proofingRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

// Kiểm tra kết nối API & Supabase
router.get('/health', async (req, res) => {
  const { error } = await supabase.from('phong_chup').select('id').limit(1);
  if (error) {
    return res.status(503).json({
      success: false,
      status: 'degraded',
      message: 'Backend đang chạy nhưng kết nối Supabase gặp lỗi',
      error: error.message,
    });
  }
  return res.json({
    success: true,
    status: 'ok',
    message: 'Backend Node.js và Supabase đang hoạt động tốt!',
  });
});

router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/bookings', bookingRoutes);
router.use('/albums', proofingRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
