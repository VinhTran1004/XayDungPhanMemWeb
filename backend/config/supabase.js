const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Cảnh báo: SUPABASE_URL hoặc SUPABASE_KEY chưa được cấu hình trong file .env');
}

const supabase = createClient(supabaseUrl || '', supabaseKey || '');

module.exports = supabase;

