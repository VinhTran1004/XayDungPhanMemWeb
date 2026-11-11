const supabase = require('../config/supabase');

// Ví dụ: Lấy danh sách bản ghi từ một bảng (thay 'items' bằng tên bảng trong Supabase của bạn)
const getItems = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('items') // <-- Đổi tên bảng ở đây
      .select('*');

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// Ví dụ: Thêm một bản ghi mới vào bảng
const createItem = async (req, res) => {
  try {
    const newItem = req.body;

    const { data, error } = await supabase
      .from('items') // <-- Đổi tên bảng ở đây
      .insert([newItem])
      .select();

    if (error) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getItems,
  createItem,
};

