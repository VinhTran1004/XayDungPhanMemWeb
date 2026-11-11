const express = require('express');
const router = express.Router();
const { getItems, createItem } = require('../controllers/exampleController');

// Test kết nối API
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Node.js đang hoạt động tốt!' });
});

// Các endpoint truy vấn Supabase mẫu
router.get('/items', getItems);
router.post('/items', createItem);

module.exports = router;

