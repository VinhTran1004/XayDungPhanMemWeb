// =========================================================================================
// TỆP: frontend/src/api/client.js
// MỤC ĐÍCH: Trung tâm điều phối gọi API (API Client) kết nối Frontend React với Backend Node.js
// -----------------------------------------------------------------------------------------
// 🎓 GIẢI THÍCH DÀNH CHO BẠN KHI GIẢNG VIÊN HỎI:
// - "API_BASE_URL là gì?": Là đường dẫn gốc của Backend API. Trên Vercel nó tự động lấy '/api',
//   còn khi chạy máy cá nhân (localhost) nó sẽ đọc từ file .env (VITE_API_URL).
// - "Cơ chế JWT Token hoạt động thế nào?": Sau khi khách/admin đăng nhập thành công, token được
//   lưu vào localStorage ('studio_token'). Mỗi khi gọi request cần xác thực, hàm request()
//   sẽ tự động gắn header: `Authorization: Bearer <token>`.
// =========================================================================================

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Hàm gửi HTTP Request dùng chung cho toàn bộ dự án
 * Tự động parse JSON, tự động đính kèm Token và bắt lỗi trả về thông báo tiếng Việt
 */
export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('studio_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Nếu gửi ảnh FormData (upload file) thì không set Content-Type để browser tự sinh boundary
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));

    // Nếu Backend trả mã lỗi (400, 401, 403, 404, 500...)
    if (!response.ok) {
      const errorMessage = data?.message || data?.error || `Lỗi máy chủ (${response.status})`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.errorCode = data?.errorCode;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    console.error(`[Lỗi API] [${endpoint}]:`, error);
    throw error;
  }
}

// =========================================================================================
// 1. NHÓM API XÁC THỰC TÀI KHOẢN (AUTH)
// =========================================================================================
export const authApi = {
  // POST /api/auth/login - Đăng nhập tài khoản (Khách hàng hoặc Admin)
  // Gửi lên: { email, mat_khau }
  // Nhận về: { token, user: { id, ho_ten, email, vai_tro... } }
  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),

  // POST /api/auth/register - Đăng ký tài khoản khách hàng mới
  // Gửi lên: { ho_ten, email, so_dien_thoai, mat_khau }
  // Nhận về: { token, user }
  register: (userData) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),

  // GET /api/auth/me - Lấy thông tin tài khoản đang đăng nhập từ JWT Token
  getMe: () => request('/auth/me'),
};

// =========================================================================================
// 2. NHÓM API HIỂN THỊ DỮ LIỆU & BỘ SƯU TẬP (CATALOG - PUBLIC)
// =========================================================================================
export const catalogApi = {
  // GET /api/catalog/home - Gọi 1 lần duy nhất khi vào Trang chủ
  // Nhận về: { danh_muc, concepts_noi_bat, goi_dich_vu, phong_chup }
  getHome: () => request('/catalog/home'),

  // GET /api/catalog/categories - Lấy danh mục chụp (Chân dung, Couple, Áo dài, Kỷ yếu...)
  getCategories: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/catalog/categories${query ? `?${query}` : ''}`);
  },

  // GET /api/catalog/concepts - Lấy danh sách concept kèm bộ lọc (danh_muc_id, phong_chup_id, search q)
  getConcepts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/catalog/concepts${query ? `?${query}` : ''}`);
  },

  // GET /api/catalog/concepts/:slugOrId - Xem chi tiết 1 concept, danh sách ảnh mẫu & gói chụp
  getConceptDetail: (slugOrId) => request(`/catalog/concepts/${slugOrId}`),

  // GET /api/catalog/packages - Lấy 3 gói dịch vụ quy mô (Basic, Standard, VIP)
  getPackages: () => request('/catalog/packages'),

  // GET /api/catalog/addons - Lấy danh sách dịch vụ thêm (Makeup, thêm người, file gốc, photobook)
  getAddons: () => request('/catalog/addons'),

  // GET /api/catalog/rooms - Lấy thông tin 3 phòng chụp vật lý của Studio
  getRooms: () => request('/catalog/rooms'),

  // GET /api/catalog/time-slots - Lấy 6 khung giờ hoạt động cố định (08:30 - 21:00)
  getTimeSlots: () => request('/catalog/time-slots'),

  // GET /api/catalog/photographers - Lấy danh sách đội ngũ nhiếp ảnh gia
  getPhotographers: () => request('/catalog/photographers'),
};

// =========================================================================================
// 3. NHÓM API ĐẶT LỊCH, TÍNH TIỀN, THANH TOÁN CỌC (BOOKINGS)
// =========================================================================================
export const bookingApi = {
  // GET /api/bookings/availability?ngay_chup=YYYY-MM-DD&concept_id=...
  // 🎓 GIẢNG VIÊN RẤT HAY HỎI: "Hệ thống kiểm tra trùng lịch như thế nào?"
  // -> API này kiểm tra đồng thời:
  //    1. Phòng chụp của Concept khách chọn có ai đặt chưa?
  //    2. Khung giờ đó Studio còn thợ chụp rảnh hay không?
  //    Nếu thỏa mãn cả 2 thì 'kha_dung: true', ngược lại trả về lý do hết chỗ.
  checkAvailability: (ngayChup, conceptId) =>
    request(`/bookings/availability?ngay_chup=${ngayChup}&concept_id=${conceptId}`),

  // POST /api/bookings/calculate-price - Tính toán chi phí đơn trước khi tạo
  // Gửi lên: { goi_dich_vu_id, dich_vu_them: [{ dich_vu_cong_them_id, so_luong }], ma_voucher? }
  // Nhận về: { gia_goi, tong_tien_dich_vu_them, tien_giam_voucher, tong_tien, tien_coc (30%), tien_con_lai (70%) }
  calculatePrice: (data) => request('/bookings/calculate-price', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  // POST /api/bookings - Tạo đơn đặt lịch (Trạng thái ban đầu: 'cho_thanh_toan_coc', giữ slot 15 phút)
  createBooking: (bookingData) => request('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  }),

  // POST /api/bookings/:id/pay-deposit - Xác nhận thanh toán đặt cọc 30%
  // Chuyển trạng thái đơn sang 'da_coc'
  payDeposit: (bookingId, paymentData = {}) => request(`/bookings/${bookingId}/pay-deposit`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  }),

  // GET /api/bookings/my-bookings - Lấy danh sách lịch hẹn của tài khoản khách đang đăng nhập
  getMyBookings: (trangThai) => {
    const query = trangThai ? `?trang_thai_don=${trangThai}` : '';
    return request(`/bookings/my-bookings${query}`);
  },

  // GET /api/bookings/my-vouchers - Lấy danh sách voucher bảo lưu cọc của khách
  getMyVouchers: () => request('/bookings/my-vouchers'),

  // GET /api/bookings/:id - Xem chi tiết đầy đủ 1 đơn đặt lịch
  getBookingDetail: (id) => request(`/bookings/${id}`),

  // PATCH /api/bookings/:id/reschedule - Đổi lịch chụp sang ngày/ca mới (miễn phí trước >= 24h)
  reschedule: (id, data) => request(`/bookings/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // PATCH /api/bookings/:id/cancel - Hủy lịch (trước >= 48h nhận voucher 100% hoặc hoàn 50%)
  cancelBooking: (id, data) => request(`/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

// =========================================================================================
// 4. NHÓM API CỔNG DUYỆT ẢNH TRỰC TUYẾN (CLIENT PROOFING)
// =========================================================================================
export const albumApi = {
  // GET /api/albums/my-albums - Lấy danh sách các album ảnh của khách hàng
  getMyAlbums: () => request('/albums/my-albums'),

  // GET /api/albums/:donDatLichId - Lấy chi tiết album ảnh thô & ảnh hoàn thiện theo ID đơn
  getAlbumByBookingId: (donDatLichId) => request(`/albums/${donDatLichId}`),

  // PATCH /api/albums/:albumId/photos/:photoId - Tick chọn/bỏ chọn ảnh & lưu ghi chú chỉnh sửa photoshop
  updatePhotoSelection: (albumId, photoId, data) => request(`/albums/${albumId}/photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  // POST /api/albums/:albumId/submit - Khách chốt danh sách chọn ảnh gửi thợ photoshop (khóa sửa)
  submitAlbum: (albumId) => request(`/albums/${albumId}/submit`, {
    method: 'POST',
  }),

  // GET /api/albums/:albumId/download - Nhận link tải toàn bộ ảnh hoàn thiện chất lượng cao
  getDownloadUrls: (albumId) => request(`/albums/${albumId}/download`),
};

// =========================================================================================
// 5. NHÓM API QUẢN TRỊ VIÊN STUDIO (ADMIN DASHBOARD)
// =========================================================================================
export const adminApi = {
  // GET /api/admin/stats - Thống kê tổng doanh thu, tổng số đơn, tỷ lệ lấp đầy phòng
  getStats: () => request('/admin/stats'),

  // GET /api/admin/bookings - Quản lý tất cả đơn đặt lịch của toàn studio
  getBookings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/bookings${query ? `?${query}` : ''}`);
  },

  // GET /api/admin/photographers - Lấy danh sách các thợ chụp (role = 'tho_chup')
  getPhotographers: () => request('/admin/photographers'),

  // PATCH /api/admin/bookings/:id/confirm-deposit - Admin duyệt cọc 30% thủ công
  confirmDeposit: (id) => request(`/admin/bookings/${id}/confirm-deposit`, {
    method: 'PATCH',
  }),

  // PATCH /api/admin/bookings/:id/assign-photographer - Phân công thợ chụp cho đơn
  assignPhotographer: (id, thoChupId) => request(`/admin/bookings/${id}/assign-photographer`, {
    method: 'PATCH',
    body: JSON.stringify({ tho_chup_id: thoChupId }),
  }),

  // PATCH /api/admin/bookings/:id/status - Cập nhật trạng thái đơn (đã chụp, đang hậu kỳ, hoàn thành...)
  updateStatus: (id, trangThai, ghiChuNoiBo) => request(`/admin/bookings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ trang_thai_don: trangThai, ghi_chu_noi_bo: ghiChuNoiBo }),
  }),

  // PATCH /api/admin/bookings/:id/final-payment - Tất toán 70% còn lại tại studio
  finalPayment: (id, hinhThuc = 'chuyen_khoan') => request(`/admin/bookings/${id}/final-payment`, {
    method: 'PATCH',
    body: JSON.stringify({ hinh_thuc: hinhThuc }),
  }),

  // POST /api/admin/albums/:donDatLichId/raw-photos - Upload link ảnh chụp thô cho khách chọn
  uploadRawPhotos: (donDatLichId, data) => request(`/admin/albums/${donDatLichId}/raw-photos`, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }),

  // POST /api/admin/albums/:albumId/final-photos - Upload link ảnh hoàn thiện sau khi photoshop
  uploadFinalPhotos: (albumId, data) => request(`/admin/albums/${albumId}/final-photos`, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }),

  // CRUD Danh mục / Concept / Gói / Phòng chụp
  getCatalogResource: (resource) => request(`/admin/catalog/${resource}`),
  createCatalogResource: (resource, data) => request(`/admin/catalog/${resource}`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  updateCatalogResource: (resource, id, data) => request(`/admin/catalog/${resource}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  deleteCatalogResource: (resource, id) => request(`/admin/catalog/${resource}/${id}`, {
    method: 'DELETE',
  }),
};
