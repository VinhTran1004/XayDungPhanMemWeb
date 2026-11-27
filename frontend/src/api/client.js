// API Client cho Bơ Photo Studio
// Tự động dùng /api trên Vercel hoặc biến VITE_API_URL khi chạy local
export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Gửi request tới Backend API kèm xác thực JWT
 */
export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('studio_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Nếu là FormData thì bỏ Content-Type để browser tự sinh boundary
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
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// Nhóm API Xác thực
export const authApi = {
  login: (credentials) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  }),
  register: (userData) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  }),
  getMe: () => request('/auth/me'),
};

// Nhóm API Catalog (Public)
export const catalogApi = {
  getHome: () => request('/catalog/home'),
  getCategories: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/catalog/categories${query ? `?${query}` : ''}`);
  },
  getConcepts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/catalog/concepts${query ? `?${query}` : ''}`);
  },
  getConceptDetail: (slugOrId) => request(`/catalog/concepts/${slugOrId}`),
  getPackages: () => request('/catalog/packages'),
  getAddons: () => request('/catalog/addons'),
  getRooms: () => request('/catalog/rooms'),
  getTimeSlots: () => request('/catalog/time-slots'),
  getPhotographers: () => request('/catalog/photographers'),
};

// Nhóm API Bookings
export const bookingApi = {
  checkAvailability: (ngayChup, conceptId) =>
    request(`/bookings/availability?ngay_chup=${ngayChup}&concept_id=${conceptId}`),
  
  calculatePrice: (data) => request('/bookings/calculate-price', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  createBooking: (bookingData) => request('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  }),

  payDeposit: (bookingId, paymentData = {}) => request(`/bookings/${bookingId}/pay-deposit`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  }),

  getMyBookings: (trangThai) => {
    const query = trangThai ? `?trang_thai_don=${trangThai}` : '';
    return request(`/bookings/my-bookings${query}`);
  },

  getMyVouchers: () => request('/bookings/my-vouchers'),

  getBookingDetail: (id) => request(`/bookings/${id}`),

  reschedule: (id, data) => request(`/bookings/${id}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  cancelBooking: (id, data) => request(`/bookings/${id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
};

// Nhóm API Albums (Cổng duyệt ảnh)
export const albumApi = {
  getMyAlbums: () => request('/albums/my-albums'),
  getAlbumByBookingId: (donDatLichId) => request(`/albums/${donDatLichId}`),
  updatePhotoSelection: (albumId, photoId, data) => request(`/albums/${albumId}/photos/${photoId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  submitAlbum: (albumId) => request(`/albums/${albumId}/submit`, {
    method: 'POST',
  }),
  getDownloadUrls: (albumId) => request(`/albums/${albumId}/download`),
};

// Nhóm API Admin
export const adminApi = {
  getStats: () => request('/admin/stats'),
  getBookings: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/bookings${query ? `?${query}` : ''}`);
  },
  getPhotographers: () => request('/admin/photographers'),
  confirmDeposit: (id) => request(`/admin/bookings/${id}/confirm-deposit`, {
    method: 'PATCH',
  }),
  assignPhotographer: (id, thoChupId) => request(`/admin/bookings/${id}/assign-photographer`, {
    method: 'PATCH',
    body: JSON.stringify({ tho_chup_id: thoChupId }),
  }),
  updateStatus: (id, trangThai, ghiChuNoiBo) => request(`/admin/bookings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ trang_thai_don: trangThai, ghi_chu_noi_bo: ghiChuNoiBo }),
  }),
  finalPayment: (id, hinhThuc = 'chuyen_khoan') => request(`/admin/bookings/${id}/final-payment`, {
    method: 'PATCH',
    body: JSON.stringify({ hinh_thuc: hinhThuc }),
  }),
  uploadRawPhotos: (donDatLichId, data) => request(`/admin/albums/${donDatLichId}/raw-photos`, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }),
  uploadFinalPhotos: (albumId, data) => request(`/admin/albums/${albumId}/final-photos`, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data),
  }),
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
