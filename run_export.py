
# ── Main: build workbook ──────────────────────────────────────────────────────
import sys
sys.path.insert(0, "D:/code/app hàng hải")

exec(open("D:/code/app hàng hải/export_schema.py", encoding="utf-8").read())
exec(open("D:/code/app hàng hải/append_schema.py", encoding="utf-8").read())
exec(open("D:/code/app hàng hải/append_schema2.py", encoding="utf-8").read())

# Build all table sheets
sheet_order = [
    ("Lookup", None),  # group header - skip
    ("country",       tables["country"]),
    ("port",          tables["port"]),
    ("rank",          tables["rank"]),
    ("vessel_type",   tables["vessel_type"]),
    ("cert_type",     tables["certificate_type"]),
    ("contract_type", tables["contract_type"]),
    ("course_type",   tables["course_type"]),
    ("user",          tables["user"]),
    ("seafarer",      tables["seafarer"]),
    ("sf_contact",    tables["seafarer_contact"]),
    ("sf_rank_hist",  tables["seafarer_rank_history"]),
    ("sf_cert",       tables["seafarer_certificate"]),
    ("ship_owner",    tables_extra["ship_owner"]),
    ("vessel",        tables_extra["vessel"]),
    ("vessel_cert_req", tables_extra["vessel_certificate_requirement"]),
    ("manning_agent", tables_extra["manning_agent"]),
    ("contract",      tables_extra["employment_contract"]),
    ("payroll",       tables_extra["contract_payroll"]),
    ("train_center",  tables_extra["training_center"]),
    ("train_course",  tables_extra["training_course"]),
    ("enrollment",    tables_extra["training_enrollment"]),
    ("enroll_score",  tables_extra["enrollment_score"]),
]

for sheet_name, tbl_data in sheet_order:
    if tbl_data is None:
        continue
    tbl_name, tbl_desc, tbl_cols = tbl_data
    add_table_sheet(wb, sheet_name, tbl_name, tbl_desc, tbl_cols)

add_erd_sheet(wb)
add_index_sheet(wb)
add_views_sheet(wb)

# Tab colors
tab_colors = {
    "Overview":      "1F4E79",
    "country":       "70AD47", "port": "70AD47", "rank": "70AD47",
    "vessel_type":   "70AD47", "cert_type": "70AD47",
    "contract_type": "70AD47", "course_type": "70AD47",
    "user":          "C55A11",
    "seafarer":      "ED7D31", "sf_contact": "ED7D31",
    "sf_rank_hist":  "ED7D31", "sf_cert": "ED7D31",
    "ship_owner":    "FFC000", "vessel": "FFC000", "vessel_cert_req": "FFC000",
    "manning_agent": "9E480E",
    "contract":      "C00000", "payroll": "C00000",
    "train_center":  "7030A0", "train_course": "7030A0",
    "enrollment":    "7030A0", "enroll_score": "7030A0",
    "ERD - Quan hệ": "2E75B6",
    "Indexes":       "2E75B6",
    "Views & Queries":"2E75B6",
}
for ws in wb.worksheets:
    color = tab_colors.get(ws.title)
    if color:
        ws.sheet_properties.tabColor = color

out_path = "D:/code/app hàng hải/DB_Schema_MarinePort.xlsx"
wb.save(out_path)
print(f"Saved: {out_path}")
print(f"Sheets: {[ws.title for ws in wb.worksheets]}")
