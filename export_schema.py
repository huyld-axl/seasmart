import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()

# ── helpers ──────────────────────────────────────────────────────────────────
HDR_FILL   = PatternFill("solid", fgColor="1F4E79")
GRP_FILL   = PatternFill("solid", fgColor="2E75B6")
ALT_FILL   = PatternFill("solid", fgColor="DEEAF1")
PK_FILL    = PatternFill("solid", fgColor="FFF2CC")
FK_FILL    = PatternFill("solid", fgColor="E2EFDA")
WHITE_FILL = PatternFill("solid", fgColor="FFFFFF")

HDR_FONT  = Font(bold=True, color="FFFFFF", size=11)
GRP_FONT  = Font(bold=True, color="FFFFFF", size=10)
BODY_FONT = Font(size=10)
PK_FONT   = Font(bold=True, size=10, color="7F6000")

thin = Side(style="thin", color="BFBFBF")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

def style_cell(cell, fill=None, font=None, align="left", wrap=False, border=True):
    if fill:  cell.fill = fill
    if font:  cell.font = font
    else:     cell.font = BODY_FONT
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=wrap)
    if border: cell.border = BORDER

def write_header(ws, cols, row=1):
    for c, (title, width) in enumerate(cols, 1):
        cell = ws.cell(row=row, column=c, value=title)
        style_cell(cell, HDR_FILL, HDR_FONT, "center")
        ws.column_dimensions[get_column_letter(c)].width = width
    ws.row_dimensions[row].height = 22

def write_row(ws, row_idx, values, fills):
    for c, (val, fill) in enumerate(zip(values, fills), 1):
        cell = ws.cell(row=row_idx, column=c, value=val)
        fnt  = PK_FONT if fill == PK_FILL else BODY_FONT
        style_cell(cell, fill, fnt, wrap=True)
    ws.row_dimensions[row_idx].height = 18

# ── Sheet 1: Overview ─────────────────────────────────────────────────────────
ws0 = wb.active
ws0.title = "Overview"
ws0.sheet_view.showGridLines = False

title_cell = ws0.cell(row=1, column=1, value="HỆ THỐNG QUẢN LÝ THUYỀN VIÊN HÀNG HẢI")
title_cell.font = Font(bold=True, size=16, color="1F4E79")
title_cell.alignment = Alignment(horizontal="center", vertical="center")
ws0.merge_cells("A1:F1")
ws0.row_dimensions[1].height = 36

sub_cell = ws0.cell(row=2, column=1, value="Database Schema Design - MarinePort (MySQL)")
sub_cell.font = Font(italic=True, size=11, color="595959")
sub_cell.alignment = Alignment(horizontal="center")
ws0.merge_cells("A2:F2")
ws0.row_dimensions[2].height = 20

ws0.cell(row=3, column=1)  # spacer

overview_cols = [("Nhóm", 18), ("Tên bảng (Table)", 30), ("Mô tả", 50), ("Số cột", 10), ("Ghi chú", 30)]
write_header(ws0, overview_cols, row=4)

overview_data = [
    # group, table, desc, cols, notes
    ("Lookup / Reference", "country",                      "Quốc gia, quốc tịch",                                  4,  "ISO 3166-1"),
    ("Lookup / Reference", "port",                         "Cảng biển (UN/LOCODE)",                                 5,  ""),
    ("Lookup / Reference", "rank",                         "Chức danh thuyền viên (Master, C/O, OS...)",            6,  ""),
    ("Lookup / Reference", "vessel_type",                  "Loại tàu (Bulk, Tanker, Container...)",                 5,  ""),
    ("Lookup / Reference", "certificate_type",             "21+ loại chứng chỉ STCW",                              9,  "Nguồn: STR-05-06"),
    ("Lookup / Reference", "contract_type",                "Loại hợp đồng (ITF, CBA...)",                          4,  ""),
    ("Lookup / Reference", "course_type",                  "Loại khóa đào tạo",                                    6,  ""),
    ("Auth & Phân quyền",  "user",                         "Tài khoản đăng nhập, phân quyền theo role",           11,  "Tách biệt với hồ sơ thuyền viên"),
    ("Core - Thuyền viên", "seafarer",                     "Thuyền viên - bảng trung tâm",                        48,  "Nguồn: HD-Hong data sheet"),
    ("Core - Thuyền viên", "seafarer_contact",             "Người nhà, liên lạc khẩn cấp, người bảo lãnh",        18,  ""),
    ("Core - Thuyền viên", "seafarer_rank_history",        "Lịch sử thăng tiến chức danh",                         6,  ""),
    ("Core - Thuyền viên", "seafarer_certificate",         "Bằng cấp / chứng chỉ + ngày hết hạn",                 12,  "Nguồn: STR-05-06"),
    ("Tàu & Chủ tàu",      "ship_owner",                  "Chủ tàu / Công ty quản lý tàu",                        14,  "Nguồn: HD-Hong"),
    ("Tàu & Chủ tàu",      "vessel",                      "Tàu biển (IMO, DWT, GT...)",                           18,  ""),
    ("Tàu & Chủ tàu",      "vessel_certificate_requirement","Ma trận chứng chỉ yêu cầu theo tàu/chức danh",        6,  "Nguồn: STR-05-06"),
    ("Hợp đồng",           "manning_agent",               "Công ty môi giới / cung ứng thuyền viên",              14,  ""),
    ("Hợp đồng",           "employment_contract",         "Hợp đồng lao động (lương USD, bảo hiểm...)",           30,  "Nguồn: HD-Hong"),
    ("Hợp đồng",           "contract_payroll",            "Bảng lương chi tiết theo tháng",                       16,  ""),
    ("Đào tạo",            "training_center",             "Trung tâm đào tạo thuyền viên",                        12,  "Nguồn: IMSCO"),
    ("Đào tạo",            "training_course",             "Khóa học cụ thể (ESCO 2024 K6...)",                    12,  ""),
    ("Đào tạo",            "training_enrollment",         "Đăng ký học + kết quả tổng hợp",                       14,  "Nguồn: Tong hop danh gia"),
    ("Đào tạo",            "enrollment_score",            "Điểm chi tiết từng tiêu chí đánh giá",                  8,  "7 tiêu chí phỏng vấn"),
]

group_colors = {
    "Lookup / Reference": PatternFill("solid", fgColor="E8F4FD"),
    "Auth & Phân quyền":  PatternFill("solid", fgColor="FCE4D6"),
    "Core - Thuyền viên": PatternFill("solid", fgColor="E8F8E8"),
    "Tàu & Chủ tàu":      PatternFill("solid", fgColor="FFF8E8"),
    "Hợp đồng":           PatternFill("solid", fgColor="FDE8F4"),
    "Đào tạo":            PatternFill("solid", fgColor="F4E8FD"),
}

for i, (grp, tbl, desc, ncols, notes) in enumerate(overview_data):
    r = i + 5
    fill = group_colors.get(grp, WHITE_FILL)
    write_row(ws0, r, [grp, tbl, desc, ncols, notes],
              [fill]*5)

ws0.freeze_panes = "A5"

# ── Sheet builder ─────────────────────────────────────────────────────────────
SCHEMA_COLS = [
    ("STT",          5),
    ("Tên cột",      28),
    ("Kiểu dữ liệu", 22),
    ("Null?",         8),
    ("Mặc định",     18),
    ("Khóa",         10),
    ("Mô tả (VI)",   45),
]

def add_table_sheet(wb, sheet_name, table_name, description, columns):
    """columns: list of (stt, col_name, dtype, nullable, default, key, desc_vi)"""
    ws = wb.create_sheet(sheet_name)
    ws.sheet_view.showGridLines = False

    # Title
    t = ws.cell(row=1, column=1, value=f"Bảng: {table_name}")
    t.font = Font(bold=True, size=13, color="1F4E79")
    t.alignment = Alignment(horizontal="left", vertical="center")
    ws.merge_cells(f"A1:G1")
    ws.row_dimensions[1].height = 28

    d = ws.cell(row=2, column=1, value=description)
    d.font = Font(italic=True, size=10, color="595959")
    ws.merge_cells("A2:G2")
    ws.row_dimensions[2].height = 18

    write_header(ws, SCHEMA_COLS, row=3)

    key_fills = {"PK": PK_FILL, "FK": FK_FILL, "PK,FK": PatternFill("solid", fgColor="FCE4D6")}

    for i, col in enumerate(columns):
        r = i + 4
        stt, name, dtype, nullable, default, key, desc = col
        fill = key_fills.get(key, ALT_FILL if i % 2 == 0 else WHITE_FILL)
        write_row(ws, r, [stt, name, dtype, nullable, default, key, desc],
                  [fill]*7)

    ws.freeze_panes = "A4"
    return ws

# ── Table definitions ─────────────────────────────────────────────────────────
# Format: (stt, col_name, dtype, nullable, default, key, desc_vi)

tables = {}

tables["country"] = ("country", "Quốc gia / Quốc tịch", [
    (1,  "id",         "INT AUTO_INCREMENT",       "NOT NULL", "auto",    "PK", "Khóa chính"),
    (2,  "code",       "CHAR(2)",      "NOT NULL", "",        "",   "Mã ISO 3166-1 alpha-2 (VN, CN, JP...)"),
    (3,  "name_en",    "VARCHAR(100)", "NOT NULL", "",        "",   "Tên tiếng Anh"),
    (4,  "name_vi",    "VARCHAR(100)", "NULL",     "",        "",   "Tên tiếng Việt"),
    (5,  "created_at", "DATETIME",  "NOT NULL", "NOW()",   "",   "Thời điểm tạo"),
])

tables["port"] = ("port", "Cảng biển", [
    (1,  "id",          "INT AUTO_INCREMENT",      "NOT NULL", "auto",  "PK", "Khóa chính"),
    (2,  "un_locode",   "CHAR(5)",     "NULL",     "",      "",   "Mã UN/LOCODE (VNSGN, CNQIN...)"),
    (3,  "name",        "VARCHAR(150)","NOT NULL", "",      "",   "Tên cảng"),
    (4,  "country_id",  "INT",         "NOT NULL", "",      "FK", "Quốc gia → country.id"),
    (5,  "created_at",  "DATETIME", "NOT NULL", "NOW()", "",   "Thời điểm tạo"),
])

tables["rank"] = ("rank", "Chức danh thuyền viên", [
    (1,  "id",          "INT AUTO_INCREMENT",      "NOT NULL", "auto",  "PK", "Khóa chính"),
    (2,  "code",        "VARCHAR(20)", "NOT NULL", "",      "",   "Mã chức danh (MASTER, C/O, C/E, OS, OLR...)"),
    (3,  "name_vi",     "VARCHAR(100)","NOT NULL", "",      "",   "Tên tiếng Việt (Thuyền trưởng, Đại phó...)"),
    (4,  "name_en",     "VARCHAR(100)","NOT NULL", "",      "",   "Tên tiếng Anh"),
    (5,  "department",  "VARCHAR(50)", "NULL",     "",      "",   "Bộ phận: DECK / ENGINE / CATERING"),
    (6,  "rank_level",  "SMALLINT",    "NULL",     "",      "",   "1=Sĩ quan, 2=Thủy thủ, 3=Phục vụ"),
    (7,  "created_at",  "DATETIME", "NOT NULL", "NOW()", "",   "Thời điểm tạo"),
])

tables["vessel_type"] = ("vessel_type", "Loại tàu biển", [
    (1,  "id",       "INT AUTO_INCREMENT",       "NOT NULL", "auto",  "PK", "Khóa chính"),
    (2,  "code",     "VARCHAR(30)",  "NOT NULL", "",      "",   "Mã loại (BULK_CARRIER, TANKER, CONTAINER...)"),
    (3,  "name_vi",  "VARCHAR(100)", "NOT NULL", "",      "",   "Tên tiếng Việt"),
    (4,  "name_en",  "VARCHAR(100)", "NOT NULL", "",      "",   "Tên tiếng Anh"),
    (5,  "created_at","DATETIME", "NOT NULL", "NOW()", "",   "Thời điểm tạo"),
])

tables["certificate_type"] = ("certificate_type", "Loại chứng chỉ / bằng cấp (21+ loại STCW)", [
    (1,  "id",                "INT AUTO_INCREMENT",       "NOT NULL", "auto",   "PK", "Khóa chính"),
    (2,  "code",              "VARCHAR(50)",  "NOT NULL", "",       "",   "Mã chứng chỉ (STCW_BASIC, GMDSS_GOC, ECDIS...)"),
    (3,  "name_vi",           "VARCHAR(200)", "NOT NULL", "",       "",   "Tên tiếng Việt"),
    (4,  "name_en",           "VARCHAR(200)", "NOT NULL", "",       "",   "Tên tiếng Anh"),
    (5,  "issuing_authority", "VARCHAR(200)", "NULL",     "",       "",   "Cơ quan cấp (VMS, VINAMARINE...)"),
    (6,  "validity_years",    "SMALLINT",     "NULL",     "",       "",   "Thời hạn hiệu lực (năm). NULL = vĩnh viễn"),
    (7,  "is_stcw",           "TINYINT(1)",      "NOT NULL", "TRUE",   "",   "Có phải chứng chỉ STCW không"),
    (8,  "required_for_ranks","JSON",          "NULL",     "",       "",   "Mảng rank.id yêu cầu chứng chỉ này (JSON array)"),
    (9,  "created_at",        "DATETIME",  "NOT NULL", "NOW()",  "",   "Thời điểm tạo"),
    (10, "updated_at",        "DATETIME",  "NOT NULL", "NOW()",  "",   "Thời điểm cập nhật"),
])

tables["contract_type"] = ("contract_type", "Loại hợp đồng lao động", [
    (1,  "id",       "INT AUTO_INCREMENT",       "NOT NULL", "auto",  "PK", "Khóa chính"),
    (2,  "code",     "VARCHAR(30)",  "NOT NULL", "",      "",   "Mã loại (ITF, CBA, COMPANY_STANDARD...)"),
    (3,  "name_vi",  "VARCHAR(100)", "NOT NULL", "",      "",   "Tên tiếng Việt"),
    (4,  "name_en",  "VARCHAR(100)", "NULL",     "",      "",   "Tên tiếng Anh"),
    (5,  "created_at","DATETIME", "NOT NULL", "NOW()", "",   "Thời điểm tạo"),
])

tables["course_type"] = ("course_type", "Loại khóa đào tạo", [
    (1,  "id",                  "INT AUTO_INCREMENT",       "NOT NULL", "auto",  "PK", "Khóa chính"),
    (2,  "code",                "VARCHAR(50)",  "NOT NULL", "",      "",   "Mã khóa học (ESCO, STCW_BASIC, AFF...)"),
    (3,  "name_vi",             "VARCHAR(150)", "NOT NULL", "",      "",   "Tên tiếng Việt"),
    (4,  "name_en",             "VARCHAR(150)", "NULL",     "",      "",   "Tên tiếng Anh"),
    (5,  "certificate_type_id", "INT",          "NULL",     "",      "FK", "Chứng chỉ đầu ra → certificate_type.id"),
    (6,  "duration_days",       "SMALLINT",     "NULL",     "",      "",   "Thời lượng khóa học (ngày)"),
    (7,  "created_at",          "DATETIME",  "NOT NULL", "NOW()", "",   "Thời điểm tạo"),
])

tables["user"] = ("user", "Tài khoản đăng nhập - xác thực và phân quyền", [
    (1,  "id",                   "INT AUTO_INCREMENT",        "NOT NULL", "auto",        "PK", "Khóa chính"),
    (2,  "email",                "VARCHAR(150)",  "NOT NULL", "",            "",   "Email đăng nhập (unique)"),
    (3,  "password_hash",        "VARCHAR(255)",  "NOT NULL", "",            "",   "Mật khẩu đã hash (bcrypt)"),
    (4,  "role",                 "VARCHAR(30)",   "NOT NULL", "",            "",   "Phân quyền: admin | operator | training_center | manning_agent | seafarer"),
    (5,  "linked_entity_type",   "VARCHAR(30)",   "NULL",     "",            "",   "Loại entity liên kết: seafarer | training_center | manning_agent | NULL"),
    (6,  "linked_entity_id",     "INT",           "NULL",     "",            "",   "ID entity liên kết (FK động theo linked_entity_type)"),
    (7,  "is_active",            "TINYINT(1)",       "NOT NULL", "TRUE",        "",   "Tài khoản đang hoạt động"),
    (8,  "last_login_at",        "DATETIME",   "NULL",     "",            "",   "Lần đăng nhập cuối"),
    (9,  "created_at",           "DATETIME",   "NOT NULL", "NOW()",       "",   "Thời điểm tạo"),
    (10, "updated_at",           "DATETIME",   "NOT NULL", "NOW()",       "",   "Thời điểm cập nhật"),
    (11, "deleted_at",           "DATETIME",   "NULL",     "",            "",   "Soft delete"),
])

tables["seafarer"] = ("seafarer", "Thuyền viên - bảng trung tâm của hệ thống", [
    (1,  "id",                   "INT AUTO_INCREMENT",        "NOT NULL", "auto",        "PK", "Khóa chính"),
    (2,  "seafarer_code",        "VARCHAR(30)",   "NULL",     "",            "",   "Mã nội bộ (năm + số thứ tự)"),
    (3,  "national_id",          "VARCHAR(20)",   "NULL",     "",            "",   "Số CCCD / CMND"),
    (4,  "passport_number",      "VARCHAR(20)",   "NULL",     "",            "",   "Số hộ chiếu"),
    (5,  "passport_expiry",      "DATE",          "NULL",     "",            "",   "Ngày hết hạn hộ chiếu"),
    (6,  "seaman_book_number",   "VARCHAR(30)",   "NULL",     "",            "",   "Số sổ thuyền viên"),
    (7,  "seaman_book_expiry",   "DATE",          "NULL",     "",            "",   "Ngày hết hạn sổ thuyền viên"),
    (8,  "vietnam_registry_id",  "VARCHAR(30)",   "NULL",     "",            "",   "Mã đăng ký VMS (từ data-1712759651518)"),
    (9,  "full_name",            "VARCHAR(150)",  "NOT NULL", "",            "",   "Họ và tên đầy đủ"),
    (10, "full_name_en",         "VARCHAR(150)",  "NULL",     "",            "",   "Tên theo hộ chiếu (tiếng Anh)"),
    (11, "date_of_birth",        "DATE",          "NOT NULL", "",            "",   "Ngày sinh"),
    (12, "place_of_birth",       "VARCHAR(200)",  "NULL",     "",            "",   "Nơi sinh"),
    (13, "gender",               "CHAR(1)",       "NOT NULL", "'M'",         "",   "Giới tính: M / F"),
    (14, "nationality_id",       "INT",           "NOT NULL", "",            "FK", "Quốc tịch → country.id"),
    (15, "ethnicity",            "VARCHAR(50)",   "NULL",     "",            "",   "Dân tộc"),
    (16, "religion",             "VARCHAR(50)",   "NULL",     "",            "",   "Tôn giáo"),
    (17, "permanent_address",    "TEXT",          "NULL",     "",            "",   "Địa chỉ thường trú (số nhà, đường)"),
    (18, "permanent_ward",       "VARCHAR(100)",  "NULL",     "",            "",   "Phường / Xã"),
    (19, "permanent_district",   "VARCHAR(100)",  "NULL",     "",            "",   "Quận / Huyện"),
    (20, "permanent_province",   "VARCHAR(100)",  "NULL",     "",            "",   "Tỉnh / Thành phố"),
    (21, "contact_address",      "TEXT",          "NULL",     "",            "",   "Địa chỉ liên lạc (nếu khác thường trú)"),
    (22, "phone_primary",        "VARCHAR(20)",   "NULL",     "",            "",   "Số điện thoại chính"),
    (23, "phone_secondary",      "VARCHAR(20)",   "NULL",     "",            "",   "Số điện thoại phụ"),
    (24, "email",                "VARCHAR(150)",  "NULL",     "",            "",   "Email"),
    (25, "height_cm",            "SMALLINT",      "NULL",     "",            "",   "Chiều cao (cm)"),
    (26, "weight_kg",            "SMALLINT",      "NULL",     "",            "",   "Cân nặng (kg)"),
    (27, "blood_type",           "VARCHAR(5)",    "NULL",     "",            "",   "Nhóm máu (A+, B-, AB+, O...)"),
    (28, "medical_cert_number",  "VARCHAR(50)",   "NULL",     "",            "",   "Số giấy khám sức khỏe"),
    (29, "medical_cert_expiry",  "DATE",          "NULL",     "",            "",   "Ngày hết hạn giấy khám sức khỏe"),
    (30, "education_level",      "VARCHAR(50)",   "NULL",     "",            "",   "Trình độ học vấn (Đại học, Cao đẳng...)"),
    (31, "education_major",      "VARCHAR(150)",  "NULL",     "",            "",   "Chuyên ngành"),
    (32, "education_school",     "VARCHAR(200)",  "NULL",     "",            "",   "Trường đào tạo"),
    (33, "english_level",        "VARCHAR(50)",   "NULL",     "",            "",   "Trình độ tiếng Anh"),
    (34, "english_score",        "SMALLINT",      "NULL",     "",            "",   "Điểm thi tiếng Anh"),
    (35, "current_rank_id",      "INT",           "NULL",     "",            "FK", "Chức danh hiện tại → rank.id"),
    (36, "bank_account_number",  "VARCHAR(30)",   "NULL",     "",            "",   "Số tài khoản ngân hàng"),
    (37, "bank_name",            "VARCHAR(100)",  "NULL",     "",            "",   "Tên ngân hàng"),
    (38, "bank_branch",          "VARCHAR(150)",  "NULL",     "",            "",   "Chi nhánh ngân hàng"),
    (39, "social_insurance_number","VARCHAR(20)", "NULL",     "",            "",   "Số sổ BHXH"),
    (40, "social_insurance_date","DATE",          "NULL",     "",            "",   "Ngày tham gia BHXH"),
    (41, "status",               "VARCHAR(30)",   "NOT NULL", "'AVAILABLE'", "",   "Trạng thái: AVAILABLE / ON_VESSEL / ON_LEAVE / TRAINING / BLACKLISTED / RETIRED / INACTIVE"),
    (42, "notes",                "TEXT",          "NULL",     "",            "",   "Ghi chú"),
    (43, "user_id",              "INT",           "NULL",     "",            "FK", "Tài khoản đăng nhập → user.id (nullable - admin có thể tạo hồ sơ chưa có tài khoản)"),
    (44, "created_by",           "INT",           "NULL",     "",            "FK", "Người tạo record → user.id"),
    (45, "updated_by",           "INT",           "NULL",     "",            "FK", "Người cập nhật lần cuối → user.id"),
    (46, "created_at",           "DATETIME",   "NOT NULL", "NOW()",       "",   "Thời điểm tạo"),
    (47, "updated_at",           "DATETIME",   "NOT NULL", "NOW()",       "",   "Thời điểm cập nhật"),
    (48, "deleted_at",           "DATETIME",   "NULL",     "",            "",   "Soft delete - NULL = chưa xóa"),
])

tables["seafarer_contact"] = ("seafarer_contact", "Người nhà / Liên lạc khẩn cấp / Người bảo lãnh", [
    (1,  "id",                       "INT AUTO_INCREMENT",       "NOT NULL", "auto",   "PK", "Khóa chính"),
    (2,  "seafarer_id",              "INT",          "NOT NULL", "",       "FK", "Thuyền viên → seafarer.id"),
    (3,  "relationship",             "VARCHAR(50)",  "NOT NULL", "",       "",   "Quan hệ: Vợ/Chồng, Cha, Mẹ, Con, Anh/Chị/Em"),
    (4,  "is_emergency_contact",     "TINYINT(1)",      "NOT NULL", "FALSE",  "",   "Là người liên lạc khẩn cấp"),
    (5,  "is_guarantor",             "TINYINT(1)",      "NOT NULL", "FALSE",  "",   "Là người bảo lãnh"),
    (6,  "full_name",                "VARCHAR(150)", "NOT NULL", "",       "",   "Họ và tên"),
    (7,  "date_of_birth",            "DATE",         "NULL",     "",       "",   "Ngày sinh"),
    (8,  "national_id",              "VARCHAR(20)",  "NULL",     "",       "",   "Số CCCD / CMND"),
    (9,  "phone_primary",            "VARCHAR(20)",  "NULL",     "",       "",   "Số điện thoại chính"),
    (10, "phone_secondary",          "VARCHAR(20)",  "NULL",     "",       "",   "Số điện thoại phụ"),
    (11, "email",                    "VARCHAR(150)", "NULL",     "",       "",   "Email"),
    (12, "address",                  "TEXT",         "NULL",     "",       "",   "Địa chỉ"),
    (13, "ward",                     "VARCHAR(100)", "NULL",     "",       "",   "Phường / Xã"),
    (14, "district",                 "VARCHAR(100)", "NULL",     "",       "",   "Quận / Huyện"),
    (15, "province",                 "VARCHAR(100)", "NULL",     "",       "",   "Tỉnh / Thành phố"),
    (16, "occupation",               "VARCHAR(150)", "NULL",     "",       "",   "Nghề nghiệp"),
    (17, "workplace",                "VARCHAR(200)", "NULL",     "",       "",   "Nơi làm việc"),
    (18, "guarantor_id_number",      "VARCHAR(20)",  "NULL",     "",       "",   "CCCD người bảo lãnh (nếu is_guarantor)"),
    (19, "guarantor_id_issued_date", "DATE",         "NULL",     "",       "",   "Ngày cấp CCCD người bảo lãnh"),
    (20, "guarantor_id_issued_place","VARCHAR(150)", "NULL",     "",       "",   "Nơi cấp CCCD người bảo lãnh"),
    (21, "created_at",               "DATETIME",  "NOT NULL", "NOW()",  "",   "Thời điểm tạo"),
    (22, "updated_at",               "DATETIME",  "NOT NULL", "NOW()",  "",   "Thời điểm cập nhật"),
])

tables["seafarer_rank_history"] = ("seafarer_rank_history", "Lịch sử thăng tiến / thay đổi chức danh", [
    (1,  "id",             "INT AUTO_INCREMENT",      "NOT NULL", "auto",  "PK", "Khóa chính"),
    (2,  "seafarer_id",    "INT",         "NOT NULL", "",      "FK", "Thuyền viên → seafarer.id"),
    (3,  "rank_id",        "INT",         "NOT NULL", "",      "FK", "Chức danh → rank.id"),
    (4,  "effective_date", "DATE",        "NOT NULL", "",      "",   "Ngày bắt đầu giữ chức danh"),
    (5,  "end_date",       "DATE",        "NULL",     "",      "",   "Ngày kết thúc. NULL = chức danh hiện tại"),
    (6,  "notes",          "TEXT",        "NULL",     "",      "",   "Ghi chú"),
    (7,  "created_at",     "DATETIME", "NOT NULL", "NOW()", "",   "Thời điểm tạo"),
])

tables["seafarer_certificate"] = ("seafarer_certificate", "Bằng cấp / Chứng chỉ của thuyền viên (nguồn: STR-05-06)", [
    (1,  "id",                   "INT AUTO_INCREMENT",       "NOT NULL", "auto",   "PK", "Khóa chính"),
    (2,  "seafarer_id",          "INT",          "NOT NULL", "",       "FK", "Thuyền viên → seafarer.id"),
    (3,  "certificate_type_id",  "INT",          "NOT NULL", "",       "FK", "Loại chứng chỉ → certificate_type.id"),
    (4,  "certificate_number",   "VARCHAR(100)", "NULL",     "",       "",   "Số chứng chỉ"),
    (5,  "issued_date",          "DATE",         "NOT NULL", "",       "",   "Ngày cấp"),
    (6,  "expiry_date",          "DATE",         "NULL",     "",       "",   "Ngày hết hạn. NULL = không có hạn"),
    (7,  "issued_by",            "VARCHAR(200)", "NULL",     "",       "",   "Cơ quan cấp"),
    (8,  "issued_at_country_id", "INT",          "NULL",     "",       "FK", "Quốc gia cấp → country.id"),
    (9,  "status",               "VARCHAR(20)",  "NOT NULL", "'VALID'","",   "Trạng thái: VALID / EXPIRED / REVOKED / PENDING"),
    (10, "document_url",         "TEXT",         "NULL",     "",       "",   "Đường dẫn file scan chứng chỉ"),
    (11, "notes",                "TEXT",         "NULL",     "",       "",   "Ghi chú"),
    (12, "created_at",           "DATETIME",  "NOT NULL", "NOW()",  "",   "Thời điểm tạo"),
    (13, "updated_at",           "DATETIME",  "NOT NULL", "NOW()",  "",   "Thời điểm cập nhật"),
])

