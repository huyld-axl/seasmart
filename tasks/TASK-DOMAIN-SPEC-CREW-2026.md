# TASK-DOMAIN-SPEC-CREW-2026 - Đặc tả nghiệp vụ Thuyền viên & đồng bộ sản phẩm

**Trạng thái:** ⏳ `BACKLOG` - chờ review, chưa bắt đầu  
**Nguồn:** Đề xuất menu, 20 chức danh, 3 trạng thái màu, hồ sơ, CV đi biển (thảo luận 2026-05-04)  
**Mục tiêu:** Căn chỉnh UI/DB/API với nghiệp vụ vận hành tàu biển; tài liệu phản ánh trạng thái thực tế.

---

## Tổng quan phạm vi

| Lĩnh vực | Nội dung |
|----------|----------|
| Menu | Thuyền viên, Đối tác, Văn bản/Hợp đồng/Quyết định, Danh mục tàu, Quản lý User (so với cấu trúc hiện tại) |
| Rank | 20 chức danh (Boong 10 + Máy 10) - seed/master data |
| Trạng thái | Standby (xanh) · Onboard (vàng) · Signoff (đỏ) - thống nhất với `seafarer.status` / deployment |
| Hồ sơ | DOB, SĐT, ảnh, quốc tịch, quê, địa chỉ, cao/cân, giấy tờ, học vấn, 2 STK, người thân, chứng chỉ |
| CV đi biển | Tàu, rank, GRT/DWT, loại tàu (GC/BC/Cont), máy/công suất, cờ, vùng, sign on/off |

---

## Danh sách task (thứ tự đề xuất)

> **Lưu ý:** Thứ tự dưới đây là gợi ý; có thể song song sau khi tách phụ thuộc. Task **D** (tài liệu) nên chạy **cuối cùng** hoặc cập nhật **từng phần** sau mỗi task lớn.

### A - Menu & điều hướng

| ID | Mô tả ngắn | Ghi chú / phụ thuộc |
|----|------------|---------------------|
| **A1** | ✅ Đã làm: đổi nhãn menu deployments, thêm route/menu `/vessels`, sắp xếp lại menu theo yêu cầu | `AdminLayout.jsx`, `locales/*.json`, `App.jsx` |
| **A2** | Phân quyền: đảm bảo accountant/operator thấy đúng mục (theo quy ước hiện tại) | Đồng bộ với A1 |

**Acceptance (A):** Menu tiếng Việt thống nhất; không mất link tới Jobs/Deployments nếu vẫn cần (hoặc ghi rõ trong tài liệu là gộp ở đâu).

---

### B - Danh mục chức danh (20 rank)

| ID | Mô tả ngắn | Ghi chú / phụ thuộc |
|----|------------|---------------------|
| **B1** | ✅ Đã làm: seed/migration danh sách rank tiếng Anh theo bộ 20 chức danh (Boong/Máy), cập nhật nhãn hiển thị qua `name_vi` | `backend/migrations/032_seed_rank_english_b1.sql` |
| **B2** | ✅ Đã làm: API/lookup rank ổn định + mapping code viết tắt thống nhất cho UI/import-export | `backend/src/routes/v1/lookup.routes.js`, `backend/migrations/032_seed_rank_english_b1.sql` |

**Acceptance (B):** Form chọn chức danh hiển thị đủ 20; master rank có thể chỉnh sửa theo quyền.

**Mapping code chuẩn (B2):**

| Nhóm | Code | English |
|------|------|---------|
| Boong | CAPT | Captain |
| Boong | CO | Chief Officer |
| Boong | 2O | 2nd Officer |
| Boong | 3O | 3rd Officer |
| Boong | BSN | Bosun |
| Boong | CARP | Carpenter |
| Boong | AB | Able Seaman Deck |
| Boong | OSD | Ordinary Seaman Deck |
| Boong | COOK | Chief Cook |
| Boong | MESS | Messman |
| Boong | DCADET | Deck Cadet |
| Máy | CE | Chief Engineer |
| Máy | 2E | 2nd Engineer |
| Máy | 3E | 3rd Engineer |
| Máy | 4E | 4th Engineer |
| Máy | FTR | Fitter |
| Máy | ETO | Electro-Technical Officer |
| Máy | ELECT | Electrician / Electrical Engineer |
| Máy | ABE | Able Seaman Engine |
| Máy | OSE | Oiler / Ordinary Seaman Engine |
| Máy | ENGINE CADET | Engine Cadet |

---

### C - Trạng thái thuyền viên (3 mức + màu)

| ID | Mô tả ngắn | Ghi chú / phụ thuộc |
|----|------------|---------------------|
| **C1** | Thiết kế mapping: `AVAILABLE`/`ON_VESSEL`/… → Standby/Onboard/Signoff (hoặc mở rộng enum) + quy tắc màu **xanh / vàng / đỏ** | Thống nhất `SeafarerListPage`, `SeafarerDetailPage`, deployment tag nếu liên quan |
| **C2** | Cập nhật UI Tag/Badge; không phá warning deployment hiện có | Test nhanh list + detail |

**Acceptance (C):** Một nguồn sự thật cho “đang ở trạng thái vận hành nào” + màu đúng spec.

---

### D - Cập nhật tài liệu dự án (bắt buộc trong phạm vi epic)

| ID | Mô tả ngắn | Phạm vi file gợi ý |
|----|------------|-------------------|
| **D1** | Cập nhật **domain & menu**: `docs/DOMAIN_OVERVIEW.md` (hoặc tương đương), mô tả menu và thuật ngữ | `docs/` |
| **D2** | Cập nhật **API/kiến trúc** nếu thêm field/endpoint: `docs/API_OVERVIEW.md`, `docs/ARCHITECTURE.md` | `docs/` |
| **D3** | Cập nhật **`tasks/README.md`**: dòng trạng thái epic + link file này; ghi chú khi task con DONE | `tasks/README.md` |
| **D4** | (Tuỳ chọn) Một dòng tóm tắt trong **`README.md`** root nếu thay đổi lớn về nghiệp vụ thuyền viên | Root `README.md` |

**Acceptance (D):** Người mới đọc doc hiểu menu, rank, trạng thái, field hồ sơ và giới hạn schema hiện tại.

---

### E - Hồ sơ cá nhân (khoảng cách so với DB)

| ID | Mô tả ngắn | Ghi chú / phụ thuộc |
|----|------------|---------------------|
| **E1** | Rà soát field: ảnh đại diện, quê quán vs nơi sinh, năm tốt nghiệp, **tách STK cá nhân / STK lương** | Migration + `seafarer.service` + form detail |
| **E2** | UI form: validation theo chuẩn project; đồng bộ i18n | `form-input-validation-standards` |

**Acceptance (E):** Các mục trong spec có chỗ lưu rõ ràng hoặc được ghi rõ “lấy từ bảng X” trong doc.

---

### F - Quá trình đi biển (CV)

| ID | Mô tả ngắn | Ghi chú / phụ thuộc |
|----|------------|---------------------|
| **F1** | Mở rộng `seafarer_deployment` (và/hoặc `vessel`): GRT/DWT, loại hàng/loại tàu (GC/BC/Cont), công suất máy, vùng hoạt động; hoặc quy ước lấy từ `vessel_id` | Migration + API + `DeploymentTab` / list |
| **F2** | Export/print CV nếu cần (có thể sau) | Phụ thuộc F1 |

**Acceptance (F):** Một dòng lịch sử hiển thị đủ thông tin nghiệp vụ tối thiểu theo spec hoặc ghi chú “phase 2”.

---

## Thứ tự thực hiện đề xuất

1. **Review & phê duyệt** danh sách này (bạn).  
2. **B** (rank) hoặc **C** (trạng thái) - thường ít phụ thuộc menu.  
3. **A** (menu) khi đã rõ tên mục “Văn bản/…”.  
4. **E** / **F** theo ưu tiên nghiệp vụ.  
5. **D** (tài liệu) **sau mỗi mảng lớn** hoặc **một lần cuối epic**.

---

## Checklist trước khi đóng epic

- [ ] Lint + test theo `pre-push-build-check` cho phần code đã sửa  
- [ ] Task **D** hoàn tất  
- [ ] `tasks/README.md` cập nhật trạng thái

---

## Ghi chú

- Không tự **force** đổi tên cột DB nếu chưa có migration tương ứng.  
- Mọi thay đổi enum trạng thái cần kế hoạch dữ liệu cũ (migrate giá trị).
