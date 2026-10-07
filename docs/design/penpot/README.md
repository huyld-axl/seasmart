# Đẩy wireframe sang Penpot

Penpot là nơi giữ bản thiết kế (thay Figma, đã hết hạn mức gói Starter).
Bản Penpot được sinh từ chính wireframe HTML, nên giữ đúng vị trí, màu, chữ và icon.

1. `extract.mjs` mở wireframe bằng Playwright, đọc hộp, màu, chữ, icon của từng phần tử ra JSON.
   `node extract.mjs <nhom-a.html> 'man=thuyen-vien&v=a&kho=desktop' out.json`
2. `pushall.py` đổi JSON thành board Penpot (rect, text, path) trên trang "Màn hình", gom nút, badge, sidebar, topbar… thành component trên trang "Components" (`pp_build.py`), rồi gọi `update-file`.
   Cần biến môi trường `PENPOT_TOKEN` (không commit token).

Wireframe chạy ở chế độ có màu (`mau=mau`). Giới hạn: hình nằm cố định, chưa có auto-layout, color/text style. Font Inter của Penpot lệch vài px so với trình duyệt.
