# Tài liệu Backend API — Bơ Photo Studio (Dành cho Frontend)

Tài liệu này mô tả chi tiết toàn bộ RESTful APIs của hệ thống **Quản lý Đặt lịch & Duyệt ảnh Studio** để Frontend tích hợp giao diện.

---

## 1. Thông tin kết nối chung

- **Base URL (Local)**: `http://localhost:5000/api`
- **Health Check**: `GET /api/health` → Kiểm tra server Backend và kết nối Supabase.
- **Xác thực (Authentication)**:
  - Các API cần đăng nhập yêu cầu gửi Header:
    ```http
    Authorization: Bearer <jwt_token>
    ```
- **Định dạng Response chuẩn**:
  - **Thành công**:
    ```json
    {
      "success": true,
      "message": "Mô tả kết quả",
      "data": { ... },
      "meta": { "page": 1, "limit": 12, "total": 4, "total_pages": 1 }
    }
    ```
  - **Thất bại**:
    ```json
    {
      "success": false,
      "errorCode": "SLOT_UNAVAILABLE",
      "message": "Thông báo lỗi tiếng Việt để hiển thị lên UI"
    }
    ```

### Tài khoản test mẫu (Mật khẩu chung: `123456`)
- **Admin (`quan_tri_vien`)**: `admin@gmail.com` / `123456`
- **Khách hàng (`khach_hang`)**: `khachang@gmail.com` / `123456`

---

## 2. Nhóm API Sản phẩm & Hiển thị Giao diện (`/api/catalog`) — Public

Nhóm API này **không cần đăng nhập**, dùng để dựng toàn bộ giao diện Trang chủ, Danh sách Concept, Chi tiết Concept, Bảng giá, Không gian phòng chụp và Đội ngũ.

### 2.1. `GET /api/catalog/home`
- **Mục đích giao diện**: Gọi **1 lần duy nhất** khi vào Trang chủ để lấy trọn bộ dữ liệu hiển thị.
- **Dữ liệu trả về (`data`)**:
  - `danh_muc`: Danh sách danh mục dịch vụ kèm `so_luong_concept`.
  - `concepts_noi_bat`: Tối đa 8 concept đang hoạt động (kèm `danh_muc_dich_vu` và `phong_chup`).
  - `goi_dich_vu`: 3 gói quy mô (`basic`, `standard`, `vip`) sắp xếp theo giá tăng dần.
  - `phong_chup`: 3 phòng chụp vật lý.

### 2.2. `GET /api/catalog/categories`
- **Mục đích giao diện**: Menu danh mục hoặc render các khối dịch vụ theo từng loại chụp.
- **Query tùy chọn**:
  - `?include_concepts=true`: mỗi danh mục sẽ kèm thêm mảng `concepts` con.
- **Dữ liệu trả về**: Mảng danh mục (`id, ten_danh_muc, duong_dan_danh_muc, mo_ta, hinh_dai_dien, so_luong_concept`, và `concepts` nếu bật flag).

### 2.3. `GET /api/catalog/concepts`
- **Mục đích giao diện**: Trang Danh sách Concept / Portfolio sản phẩm, hỗ trợ tìm kiếm & lọc.
- **Query tùy chọn**:
  - `?danh_muc_id=1`: Lọc theo ID danh mục.
  - `?duong_dan_danh_muc=chup-anh-ca-nhan`: Lọc theo slug danh mục.
  - `?phong_chup_id=2`: Lọc theo phòng chụp.
  - `?q=nang tho` (hoặc `?search=`): Tìm kiếm theo tên concept hoặc mô tả.
  - `?page=1&limit=12`: Phân trang (khi truyền sẽ trả thêm `meta: { page, limit, total, total_pages }`).
- **Dữ liệu trả về**: Danh sách concept gồm ảnh đại diện, `danh_sach_hinh_mau`, `goi_y_trang_phuc`, `danh_muc_dich_vu`, `phong_chup`.

### 2.4. `GET /api/catalog/concepts/:slugOrId`
- **Mục đích giao diện**: Trang Chi tiết Concept (hỗ trợ truyền ID như `/concepts/1` hoặc slug như `/concepts/nang-tho-vuon-cuc`).
- **Dữ liệu trả về (`data`)**:
  - Toàn bộ thông tin chi tiết concept, ảnh bìa, `danh_sach_hinh_mau`, `goi_y_trang_phuc`, `danh_muc_dich_vu`, `phong_chup`.
  - `concepts_lien_quan`: Tối đa 4 concept khác cùng danh mục.
  - `goi_dich_vu`: Danh sách các gói chụp để hiển thị ngay dưới trang chi tiết.

### 2.5. `GET /api/catalog/packages`
- **Mục đích giao diện**: Trang Bảng giá & Bước chọn Gói quy mô (`Basic`, `Standard`, `VIP`).
- **Dữ liệu trả về**: `id, ten_goi, ma_goi, mo_ta, gia_co_ban, thoi_luong_phut, so_anh_chinh_sua, so_trang_phuc_toi_da`.

### 2.6. `GET /api/catalog/addons`
- **Mục đích giao diện**: Bước chọn Dịch vụ cộng thêm (Makeup, thêm người, nhận file gốc, photobook).
- **Dữ liệu trả về**: `id, ten_dich_vu, gia, don_vi_tinh ('nguoi' | 'lan'), mo_ta`.

### 2.7. `GET /api/catalog/rooms`
- **Mục đích giao diện**: Trang giới thiệu 3 phòng chụp vật lý (`id, ten_phong, phong_cach, mo_ta`).

### 2.8. `GET /api/catalog/time-slots`
- **Mục đích giao diện**: Lấy 6 khung giờ hoạt động cố định từ 08:30 đến 21:00 (`id, ca_chup, gio_bat_dau, gio_ket_thuc`).

### 2.9. `GET /api/catalog/photographers`
- **Mục đích giao diện**: Hiển thị đội ngũ Nhiếp ảnh gia trên trang Giới thiệu (`id, ho_ten, anh_dai_dien` — đã ẩn thông tin liên hệ nhạy cảm).

---

## 3. Nhóm API Xác thực (`/api/auth`)

| Method | Endpoint | Quyền | Body / Dữ liệu trả về |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Body: `{ ho_ten, email, so_dien_thoai, mat_khau }` → Trả `{ token, user }` |
| `POST` | `/api/auth/login` | Public | Body: `{ email, mat_khau }` → Trả `{ token, user }` (dùng `user.vai_tro` để điều hướng) |
| `GET` | `/api/auth/me` | Auth | Trả về thông tin tài khoản đang đăng nhập |

---

## 4. Nhóm API Đặt lịch, Đổi lịch, Hủy lịch & Voucher (`/api/bookings`)

### 4.1. Kiểm tra ca trống & Tính chi phí
- **`GET /api/bookings/availability?ngay_chup=YYYY-MM-DD&concept_id=1`** *(Public)*:
  - Trả về trạng thái 6 ca chụp trong ngày cho concept đó (`kha_dung`, `phong_trong`, `con_tho`, `so_tho_ranh`, `ly_do_het_cho`).
- **`POST /api/bookings/calculate-price`** *(Public / kèm Token nếu dùng voucher)*:
  - Body: `{ goi_dich_vu_id, dich_vu_them: [{ dich_vu_cong_them_id, so_luong }], ma_voucher? }`
  - Trả về: `gia_goi, tong_tien_dich_vu_them, gia_goc, tien_giam_voucher, tong_tien, tien_coc (30%), tien_con_lai (70%)`.

### 4.2. Tạo đơn, Thanh toán cọc & Quản lý đơn *(Yêu cầu đăng nhập)*
- **`POST /api/bookings`**:
  - Body: `{ concept_id, goi_dich_vu_id, khung_gio_id, ngay_chup, dich_vu_them?, ma_voucher?, ghi_chu_khach_hang? }`
  - Tạo đơn ở trạng thái `cho_thanh_toan_coc`, tạm giữ slot **15 phút** (`thoi_gian_het_han_giu_cho`) và trả về `thong_tin_chuyen_khoan` (ngân hàng, STK, số tiền cọc, nội dung CK = `ma_don`).
- **`POST /api/bookings/:id/pay-deposit`**:
  - Body tùy chọn: `{ hinh_thuc: "chuyen_khoan" | "tien_mat", ma_giao_dich? }`
  - Xác nhận đã cọc 30%, chuyển đơn sang `da_coc`.
- **`GET /api/bookings/my-bookings?trang_thai_don=`**: Lịch sử đơn đặt của khách.
- **`GET /api/bookings/my-vouchers`**: Danh sách voucher bảo lưu cọc của khách (`con_hieu_luc: true/false`).
- **`GET /api/bookings/:id`**: Chi tiết đơn + `lich_su_thanh_toan` + `chi_tiet_dich_vu_them`.
- **`PATCH /api/bookings/:id/reschedule`**:
  - Body: `{ ngay_chup: "YYYY-MM-DD", khung_gio_id }`
  - Chỉ cho phép 1 lần khi trước giờ chụp `>= 24 giờ`.
- **`PATCH /api/bookings/:id/cancel`**:
  - Body: `{ phuong_an: "voucher_100" | "hoan_tien_50" }`
  - Trước `>= 48h` → `da_huy_hoan_coc` (cấp voucher 100% cọc hạn 6 tháng hoặc hoàn 50%); dưới `48h` → `da_huy_mat_coc`.

---

## 5. Nhóm API Cổng duyệt ảnh trực tuyến (`/api/albums`) — Cần đăng nhập

- **`GET /api/albums/my-albums`**: Danh sách album của khách hàng.
- **`GET /api/albums/:donDatLichId`**: Chi tiết album theo ID đơn đặt lịch, kèm mảng `anh` (có sẵn `url_anh_tho` và `url_anh_hoan_thien` dạng Signed URL xem trực tiếp) và thống kê `so_anh_da_chon / so_anh_toi_da_duoc_chon`, `phu_phi_anh_them_du_kien` (`50.000đ/ảnh` vượt gói).
- **`PATCH /api/albums/:albumId/photos/:photoId`**:
  - Body: `{ duoc_chon?: boolean, ghi_chu_khach?: string }`
  - Tick chọn ảnh & lưu ghi chú chỉnh sửa; trả về thống kê phụ phí real-time.
- **`POST /api/albums/:albumId/submit`**:
  - Chốt danh sách gửi hậu kỳ (`da_chot_chon_anh`), khóa chỉnh sửa và cộng phụ phí chọn thêm ảnh (nếu có) vào `tien_con_lai`.
- **`GET /api/albums/:albumId/download`**:
  - Lấy danh sách link tải (`download_url`) độ phân giải gốc khi album ở trạng thái `da_ban_giao`.

---

## 6. Nhóm API Dashboard Admin (`/api/admin`) — Chỉ `vai_tro = 'quan_tri_vien'`

- **`GET /api/admin/bookings`**: Lọc theo `ngay_chup`, `phong_chup_id`, `tho_chup_id`, `trang_thai_don`, `trang_thai_thanh_toan`, `ma_don`, `page`, `limit`.
- **`GET /api/admin/photographers`**: Danh sách thợ chụp (`vai_tro = 'tho_chup'`).
- **`PATCH /api/admin/bookings/:id/confirm-deposit`**: Admin duyệt cọc 30%.
- **`PATCH /api/admin/bookings/:id/assign-photographer`**: Body `{ tho_chup_id }` (kiểm tra thợ không trùng ca).
- **`PATCH /api/admin/bookings/:id/status`**: Body `{ trang_thai_don, ghi_chu_noi_bo? }`.
- **`PATCH /api/admin/bookings/:id/final-payment`**: Body `{ hinh_thuc: "tien_mat" | "chuyen_khoan" }` → tất toán 70%.
- **`POST /api/admin/albums/:donDatLichId/raw-photos`**: Upload ảnh thô (`multipart/form-data` field `photos`, tối đa 100 ảnh; hoặc JSON `{ photo_urls: [...] }`).
- **`POST /api/admin/albums/:albumId/final-photos`**: Upload ảnh hoàn thiện (`multipart/form-data` field `photos` + `anh_album_ids?` hoặc JSON `{ items: [{ anh_album_id, url }] }`).
- **`GET /api/admin/stats`**: Thống kê `tong_doanh_thu`, `tong_so_don`, `thong_ke_trang_thai`, `thong_ke_phong`.
- **`POST / PATCH / DELETE /api/admin/catalog/:resource` (`/:id`)**: CRUD danh mục (`resource`: `categories` | `concepts` | `packages` | `addons` | `rooms`).
