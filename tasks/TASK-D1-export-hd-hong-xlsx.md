# TASK-D1: Export Dữ Liệu Từ Sheet Data Ra Các Form — HD - Hong.xlsx

## Why
File HD - Hong.xlsx chứa sheet Data với thông tin thuyền viên/hợp đồng, và nhiều sheet form (hợp đồng, cam kết, biểu mẫu...).
Hiện tại phải điền thủ công từng form. Cần tự động populate dữ liệu từ sheet Data sang các form tương ứng.

## Trạng thái: PENDING

## File
`D:\code\app hàng hải\Document\HD - Hong.xlsx`

## Cần khảo sát trước khi implement

Trước khi code, cần đọc file để xác định:
1. **Sheet Data**: tên các cột, kiểu dữ liệu, số dòng
2. **Các sheet form**: danh sách tên sheet, cấu trúc từng form
3. **Mapping**: ô nào trong form tương ứng với cột nào trong Data

## Hướng tiếp cận

### Phương án A: Script Python (openpyxl)
- Đọc sheet Data, lấy dòng theo index hoặc tên
- Điền vào các ô cụ thể trong từng sheet form
- Lưu ra file mới (không ghi đè file gốc)
- **Ưu**: đơn giản, không cần cài thêm gì (Python đã có)
- **Nhược**: không có UI, phải chạy script

### Phương án B: Macro VBA trong Excel
- Nút "Export" trong Excel → chạy macro điền form
- **Ưu**: user tự dùng được trong Excel
- **Nhược**: cần enable macro, phức tạp hơn

### Phương án C: Tích hợp vào MarinePort backend
- API endpoint nhận seafarer_id → generate file Excel đã điền sẵn
- Dùng thư viện `xlsx` hoặc `exceljs`
- **Ưu**: tích hợp vào hệ thống, có thể download từ UI
- **Nhược**: cần map lại toàn bộ template

**→ Cần xem cấu trúc file thực tế để chọn phương án phù hợp**

## How — Các bước thực hiện (sau khi khảo sát)

### Bước 1: Đọc và phân tích file
```python
import openpyxl
wb = openpyxl.load_workbook(r'D:\code\app hàng hải\Document\HD - Hong.xlsx')
print(wb.sheetnames)  # Liệt kê tất cả sheet
```

### Bước 2: Map cột Data → ô form
Tạo file mapping `hd_hong_mapping.json`:
```json
{
  "HopDong": {
    "B3": "full_name",
    "B5": "date_of_birth",
    "D3": "seafarer_code"
  },
  "CamKet": {
    "C4": "full_name",
    "C6": "passport_number"
  }
}
```

### Bước 3: Script export
```python
def export_to_forms(data_row_index, output_path):
    wb = openpyxl.load_workbook(SOURCE_FILE)
    data_sheet = wb['Data']
    row = get_row_data(data_sheet, data_row_index)

    for sheet_name, mapping in MAPPINGS.items():
        sheet = wb[sheet_name]
        for cell_addr, field_name in mapping.items():
            sheet[cell_addr] = row.get(field_name, '')

    wb.save(output_path)
```

## Acceptance Criteria
- [ ] Đọc được file HD - Hong.xlsx không lỗi
- [ ] Xác định đầy đủ danh sách sheet form cần populate
- [ ] Mapping hoàn chỉnh: mỗi ô form → đúng cột trong Data
- [ ] Script/macro chạy được, output file không bị lỗi format
- [ ] Dữ liệu điền đúng vào đúng ô
- [ ] Không ghi đè file gốc (lưu ra file mới)

## Ghi chú
Cần mở file thực tế để xem cấu trúc trước khi viết mapping.
Liên hệ Hong để xác nhận các form nào cần export và thứ tự ưu tiên.
