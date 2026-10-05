
# ── Sheet: ERD / Relationships ────────────────────────────────────────────────
def add_erd_sheet(wb):
    ws = wb.create_sheet("ERD - Quan hệ")
    ws.sheet_view.showGridLines = False

    t = ws.cell(row=1, column=1, value="Sơ đồ quan hệ giữa các bảng (ERD)")
    t.font = Font(bold=True, size=13, color="1F4E79")
    t.alignment = Alignment(horizontal="left", vertical="center")
    ws.merge_cells("A1:E1")
    ws.row_dimensions[1].height = 28

    erd_cols = [("Bảng con (FK)", 35), ("Cột FK", 30), ("→ Bảng cha", 30), ("Cột PK", 15), ("Ghi chú", 40)]
    write_header(ws, erd_cols, row=2)

    rels = [
        ("port",                          "country_id",             "country",                "id",  ""),
        ("rank",                          "(lookup)",               "-",                      "-",   "Bảng độc lập"),
        ("certificate_type",              "(lookup)",               "-",                      "-",   "Bảng độc lập"),
        ("course_type",                   "certificate_type_id",    "certificate_type",       "id",  "Khóa học → chứng chỉ đầu ra"),
        ("seafarer",                      "nationality_id",         "country",                "id",  ""),
        ("seafarer",                      "current_rank_id",        "rank",                   "id",  "Chức danh hiện tại"),
        ("seafarer",                      "user_id",                "user",                   "id",  "Tài khoản đăng nhập (nullable)"),
        ("seafarer",                      "created_by",             "user",                   "id",  "Ai tạo hồ sơ"),
        ("seafarer",                      "updated_by",             "user",                   "id",  "Ai cập nhật lần cuối"),
        ("seafarer_contact",              "seafarer_id",            "seafarer",               "id",  "CASCADE DELETE"),
        ("seafarer_rank_history",         "seafarer_id",            "seafarer",               "id",  ""),
        ("seafarer_rank_history",         "rank_id",                "rank",                   "id",  ""),
        ("seafarer_certificate",          "seafarer_id",            "seafarer",               "id",  ""),
        ("seafarer_certificate",          "certificate_type_id",    "certificate_type",       "id",  ""),
        ("seafarer_certificate",          "issued_at_country_id",   "country",                "id",  ""),
        ("ship_owner",                    "country_id",             "country",                "id",  ""),
        ("vessel",                        "vessel_type_id",         "vessel_type",            "id",  ""),
        ("vessel",                        "flag_country_id",        "country",                "id",  "Quốc kỳ"),
        ("vessel",                        "port_of_registry_id",    "port",                   "id",  "Cảng đăng ký"),
        ("vessel",                        "ship_owner_id",          "ship_owner",             "id",  ""),
        ("vessel_certificate_requirement","vessel_id",              "vessel",                 "id",  ""),
        ("vessel_certificate_requirement","rank_id",                "rank",                   "id",  ""),
        ("vessel_certificate_requirement","certificate_type_id",    "certificate_type",       "id",  ""),
        ("manning_agent",                 "country_id",             "country",                "id",  ""),
        ("employment_contract",           "seafarer_id",            "seafarer",               "id",  ""),
        ("employment_contract",           "vessel_id",              "vessel",                 "id",  ""),
        ("employment_contract",           "ship_owner_id",          "ship_owner",             "id",  ""),
        ("employment_contract",           "manning_agent_id",       "manning_agent",          "id",  ""),
        ("employment_contract",           "contract_type_id",       "contract_type",          "id",  ""),
        ("employment_contract",           "rank_id",                "rank",                   "id",  "Chức danh theo HĐ"),
        ("employment_contract",           "sign_on_port_id",        "port",                   "id",  "Cảng lên tàu"),
        ("employment_contract",           "sign_off_port_id",       "port",                   "id",  "Cảng xuống tàu"),
        ("contract_payroll",              "contract_id",            "employment_contract",    "id",  ""),
        ("training_center",               "country_id",             "country",                "id",  ""),
        ("training_course",               "course_type_id",         "course_type",            "id",  ""),
        ("training_course",               "training_center_id",     "training_center",        "id",  ""),
        ("training_enrollment",           "course_id",              "training_course",        "id",  ""),
        ("training_enrollment",           "seafarer_id",            "seafarer",               "id",  ""),
        ("training_enrollment",           "rank_at_enrollment",     "rank",                   "id",  ""),
        ("training_enrollment",           "certificate_id",         "seafarer_certificate",   "id",  "Chứng chỉ được cấp sau khóa học"),
        ("enrollment_score",              "enrollment_id",          "training_enrollment",    "id",  ""),
    ]

    fills = [ALT_FILL, WHITE_FILL]
    for i, (child, fk_col, parent, pk_col, note) in enumerate(rels):
        r = i + 3
        fill = fills[i % 2]
        write_row(ws, r, [child, fk_col, parent, pk_col, note], [fill]*5)

    ws.freeze_panes = "A3"

# ── Sheet: Indexes ────────────────────────────────────────────────────────────
def add_index_sheet(wb):
    ws = wb.create_sheet("Indexes")
    ws.sheet_view.showGridLines = False

    t = ws.cell(row=1, column=1, value="Danh sách Index quan trọng")
    t.font = Font(bold=True, size=13, color="1F4E79")
    t.alignment = Alignment(horizontal="left", vertical="center")
    ws.merge_cells("A1:E1")
    ws.row_dimensions[1].height = 28

    idx_cols = [("Tên index", 40), ("Bảng", 30), ("Cột(s)", 35), ("Loại", 15), ("Mục đích", 45)]
    write_header(ws, idx_cols, row=2)

    indexes = [
        ("idx_seafarer_name",           "seafarer",                "full_name",                          "BTREE",  "Tìm kiếm theo tên"),
        ("idx_seafarer_dob",            "seafarer",                "date_of_birth",                      "BTREE",  "Lọc theo ngày sinh"),
        ("idx_seafarer_status",         "seafarer",                "status (WHERE deleted_at IS NULL)",  "PARTIAL","Lọc theo trạng thái"),
        ("idx_seafarer_rank",           "seafarer",                "current_rank_id",                    "BTREE",  "Lọc theo chức danh"),
        ("idx_seafarer_seaman_book",    "seafarer",                "seaman_book_number",                 "BTREE",  "Tra cứu sổ thuyền viên"),
        ("idx_seafarer_national_id",    "seafarer",                "national_id",                        "BTREE",  "Tra cứu CCCD"),
        ("idx_cert_seafarer",           "seafarer_certificate",    "seafarer_id",                        "BTREE",  "Lấy tất cả chứng chỉ của 1 TV"),
        ("idx_cert_expiry",             "seafarer_certificate",    "expiry_date (WHERE status=VALID)",   "PARTIAL","Cảnh báo chứng chỉ hết hạn"),
        ("idx_cert_status",             "seafarer_certificate",    "status, expiry_date",                "BTREE",  "Lọc theo trạng thái + hạn"),
        ("idx_contract_seafarer",       "employment_contract",     "seafarer_id",                        "BTREE",  "Lịch sử hợp đồng của 1 TV"),
        ("idx_contract_vessel",         "employment_contract",     "vessel_id",                          "BTREE",  "Danh sách thuyền viên trên tàu"),
        ("idx_contract_status",         "employment_contract",     "status (WHERE deleted_at IS NULL)",  "PARTIAL","Lọc HĐ đang active"),
        ("idx_contract_dates",          "employment_contract",     "start_date, end_date",               "BTREE",  "Lọc theo thời gian"),
        ("idx_rank_history_seafarer",   "seafarer_rank_history",   "seafarer_id",                        "BTREE",  "Lịch sử chức danh"),
        ("idx_payroll_contract",        "contract_payroll",        "contract_id",                        "BTREE",  "Bảng lương theo HĐ"),
        ("idx_payroll_period",          "contract_payroll",        "pay_period_year, pay_period_month",  "BTREE",  "Lọc theo kỳ lương"),
        ("idx_enrollment_course",       "training_enrollment",     "course_id",                          "BTREE",  "Danh sách học viên theo khóa"),
        ("idx_enrollment_seafarer",     "training_enrollment",     "seafarer_id",                        "BTREE",  "Lịch sử đào tạo của 1 TV"),
        ("idx_vessel_owner",            "vessel",                  "ship_owner_id",                      "BTREE",  "Tàu theo chủ tàu"),
        ("uq_seafarer_cert_active",     "seafarer_certificate",    "seafarer_id, certificate_type_id, issued_date", "UNIQUE", "Tránh trùng chứng chỉ"),
        ("uq_payroll_period",           "contract_payroll",        "contract_id, pay_period_year, pay_period_month","UNIQUE","Tránh trùng kỳ lương"),
        ("uq_vessel_cert_req",          "vessel_certificate_requirement","vessel_id, rank_id, certificate_type_id","UNIQUE","Tránh trùng yêu cầu"),
    ]

    fills = [ALT_FILL, WHITE_FILL]
    for i, row_data in enumerate(indexes):
        r = i + 3
        fill = fills[i % 2]
        write_row(ws, r, list(row_data), [fill]*5)

    ws.freeze_panes = "A3"

# ── Sheet: Views ──────────────────────────────────────────────────────────────
def add_views_sheet(wb):
    ws = wb.create_sheet("Views & Queries")
    ws.sheet_view.showGridLines = False

    t = ws.cell(row=1, column=1, value="Views và Queries hữu ích")
    t.font = Font(bold=True, size=13, color="1F4E79")
    t.alignment = Alignment(horizontal="left", vertical="center")
    ws.merge_cells("A1:D1")
    ws.row_dimensions[1].height = 28

    v_cols = [("Tên view / query", 35), ("Mục đích", 50), ("Bảng liên quan", 45), ("Ghi chú", 30)]
    write_header(ws, v_cols, row=2)

    views = [
        ("v_expiring_certificates",    "Chứng chỉ hết hạn trong 90 ngày tới",                "seafarer_certificate, seafarer, certificate_type",          "Dùng cho dashboard cảnh báo"),
        ("v_active_contracts",         "Hợp đồng đang có hiệu lực",                          "employment_contract, seafarer, vessel, ship_owner",         ""),
        ("v_seafarer_full_profile",    "Hồ sơ đầy đủ thuyền viên (join tất cả bảng liên quan)","seafarer + tất cả bảng liên quan",                        "Dùng cho trang chi tiết TV"),
        ("v_vessel_crew_matrix",       "Ma trận thuyền viên × chứng chỉ theo tàu (STR-05-06)","vessel, seafarer, seafarer_certificate, certificate_type", "Tái hiện file PDF STR-05-06"),
        ("v_training_results",         "Kết quả đào tạo tổng hợp theo khóa học",             "training_enrollment, enrollment_score, seafarer",           "Tái hiện file Tong hop danh gia"),
        ("v_seafarer_salary_history",  "Lịch sử lương theo thuyền viên",                     "contract_payroll, employment_contract, seafarer",           ""),
        ("v_manning_agent_contracts",  "Thống kê hợp đồng theo công ty môi giới",            "employment_contract, manning_agent",                        ""),
        ("v_certificates_by_vessel",   "Trạng thái chứng chỉ của thuyền viên đang trên tàu", "employment_contract, seafarer_certificate",                 "Compliance check"),
    ]

    fills = [ALT_FILL, WHITE_FILL]
    for i, row_data in enumerate(views):
        r = i + 3
        fill = fills[i % 2]
        write_row(ws, r, list(row_data), [fill]*4)

    ws.freeze_panes = "A3"
