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

## 6. Nhóm API Dashboard Admin Full CRUD (`/api/admin`) — Chỉ `vai_tro = 'quan_tri_vien'`

### 6.1. Thống kê, Giao dịch & Nhật ký hoạt động
- **`GET /api/admin/stats`**: Trả về `tong_doanh_thu`, `doanh_thu_coc`, `tong_so_don`, `doanh_thu_theo_thang`, `thong_ke_trang_thai`, `thong_ke_phong`, `thong_ke_goi_dich_vu`.
- **`GET /api/admin/activity-logs?limit=30`**: Nhật ký hoạt động mới nhất tổng hợp từ đơn đặt lịch, giao dịch thanh toán và cổng duyệt ảnh.
- **`GET /api/admin/payments`** & **`DELETE /api/admin/payments/:id`**: Quản lý lịch sử giao dịch thanh toán.

### 6.2. CRUD Đơn đặt lịch (`/api/admin/bookings`)
- **`GET /api/admin/bookings`**: Lọc theo `ngay_chup`, `phong_chup_id`, `tho_chup_id`, `trang_thai_don`, `trang_thai_thanh_toan`, `ma_don`, `page`, `limit`.
- **`GET /api/admin/bookings/:id`**: Chi tiết đơn + thanh toán + dịch vụ thêm + album.
- **`POST /api/admin/bookings`**: Tạo đơn trực tiếp cho khách tại quầy (`{ khach_hang_id, concept_id, goi_dich_vu_id, khung_gio_id, ngay_chup, tho_chup_id?, dich_vu_them?, da_thu_coc? }`).
- **`PATCH` / `PUT /api/admin/bookings/:id`**: Chỉnh sửa ngày/ca chụp, phòng, gói, thợ chụp, trạng thái, ghi chú.
- **`DELETE /api/admin/bookings/:id`**: Hủy đơn (mặc định) hoặc xóa vĩnh viễn khi truyền `?hard=true`.
- **Nghiệp vụ nhanh**:
  - `PATCH /api/admin/bookings/:id/confirm-deposit`: Duyệt cọc 30%.
  - `PATCH /api/admin/bookings/:id/assign-photographer`: Body `{ tho_chup_id }` (kiểm tra thợ không trùng ca).
  - `PATCH /api/admin/bookings/:id/status`: Body `{ trang_thai_don, ghi_chu_noi_bo? }`.
  - `PATCH /api/admin/bookings/:id/final-payment`: Body `{ hinh_thuc: "tien_mat" | "chuyen_khoan" }` → tất toán 70%.

### 6.3. CRUD Danh mục sản phẩm (`/api/admin/catalog/:resource`)
`resource` nhận 1 trong 6 loại: `categories` | `concepts` | `packages` | `addons` | `rooms` | `time-slots`
- **`GET /api/admin/catalog/:resource`**: Lấy tất cả bản ghi (kể cả mục đã ẩn `trang_thai = false`, lọc `?trang_thai=true/false`).
- **`GET /api/admin/catalog/:resource/:id`**: Xem chi tiết 1 bản ghi.
- **`POST /api/admin/catalog/:resource`**: Tạo mới (tự động sinh slug `duong_dan_*` / `ma_goi` nếu không truyền).
- **`PATCH` / `PUT /api/admin/catalog/:resource/:id`**: Cập nhật thông tin hoặc bật/tắt `trang_thai`.
- **`DELETE /api/admin/catalog/:resource/:id`**: Ẩn mềm (`trang_thai = false`), hoặc truyền `?hard=true` để xóa vĩnh viễn nếu chưa phát sinh đơn.

### 6.4. CRUD Người dùng & Nhiếp ảnh gia (`/api/admin/users` & `/api/admin/photographers`)
- **`GET /api/admin/users?vai_tro=&trang_thai=&q=&page=&limit=`**: Danh sách toàn bộ người dùng (`khach_hang`, `tho_chup`, `quan_tri_vien`).
- **`GET /api/admin/users/:id`**: Chi tiết tài khoản + số đơn đã đặt / số ca chụp đã nhận.
- **`POST /api/admin/users`**: Tạo tài khoản mới (`{ ho_ten, email, so_dien_thoai, mat_khau?, vai_tro?, anh_dai_dien? }`).
- **`PATCH` / `PUT /api/admin/users/:id`**: Sửa thông tin, đổi vai trò, reset mật khẩu, khóa/mở khóa (`trang_thai`).
- **`DELETE /api/admin/users/:id`**: Khóa tài khoản (`trang_thai = false`), hoặc `?hard=true` để xóa hẳn.
- **Nhánh nhanh cho Nhiếp ảnh gia**: `GET / POST /api/admin/photographers` và `PATCH / PUT / DELETE /api/admin/photographers/:id`.

### 6.5. CRUD Album & Duyệt ảnh (`/api/admin/albums`)
- **`GET /api/admin/albums`** & **`GET /api/admin/albums/:id`**: Danh sách và chi tiết album kèm ảnh (Signed URL).
- **`POST /api/admin/albums`**: Tạo mới album (`{ don_dat_lich_id, tieu_de?, so_anh_toi_da_duoc_chon? }`).
- **`PATCH` / `PUT /api/admin/albums/:id`**: Sửa tiêu đề, số ảnh tối đa, trạng thái album.
- **`DELETE /api/admin/albums/:id`**: Xóa album cùng toàn bộ ảnh trong Storage.
- **`DELETE /api/admin/albums/:albumId/photos/:photoId`**: Xóa 1 ảnh lẻ trong album & cập nhật lại số lượng.
- **`POST /api/admin/albums/:donDatLichId/raw-photos`** & **`POST /api/admin/albums/:albumId/final-photos`**: Upload ảnh thô và ảnh hoàn thiện.

### 6.6. CRUD Mã giảm giá / Bảo lưu cọc (`/api/admin/vouchers`)
- **`GET /api/admin/vouchers?da_su_dung=&khach_hang_id=&q=`**: Danh sách voucher toàn hệ thống.
- **`POST /api/admin/vouchers`**: Cấp voucher mới (`{ khach_hang_id, gia_tri, ma_voucher?, so_thang_hieu_luc? }`).
- **`PATCH` / `PUT /api/admin/vouchers/:id`**: Gia hạn, đổi giá trị hoặc trạng thái `da_su_dung`.
- **`DELETE /api/admin/vouchers/:id`**: Xóa voucher.
