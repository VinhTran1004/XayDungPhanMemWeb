require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Lỗi: Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function kiemTraKetNoi() {
  console.log('🔄 Đang thử kết nối tới Supabase...');
  
  // Thử truy vấn 1 bản ghi từ bảng nguoi_dung
  const { data, error } = await supabase
    .from('nguoi_dung')
    .select('id, ho_ten, email, vai_tro')
    .limit(1);

  if (error) {
    console.error('❌ Kết nối thất bại! Chi tiết lỗi:', error.message);
  } else {
    console.log('✅ KẾT NỐI SUPABASE THÀNH CÔNG!');
    console.log('📊 Dữ liệu mẫu lấy từ bảng nguoi_dung:', data);
  }
}

kiemTraKetNoi();