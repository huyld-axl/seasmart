CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Danh mục tàu tra cứu nhanh, nạp từ ships_plain.db bằng scripts/seed_ship_catalog.js.
-- Chỉ để gợi ý tên / IMO khi chọn tàu; dữ liệu chi tiết của tàu nằm ở bảng vessel.
CREATE TABLE "ship_catalog" (
  "source_id" BIGINT NOT NULL PRIMARY KEY,          -- IMO_NO gốc; âm hoặc quá 7 chữ số là mã giả của nguồn
  "imo_number" varchar(7),                          -- chỉ khi source_id nằm trong 1000000..9999999
  "ship_name" varchar(255) NOT NULL,
  "mmsi" varchar(9),
  "ship_type" varchar(100),
  "ship_type_group" varchar(100),
  "flag_code" varchar(2),                           -- ISO2; rỗng nếu nguồn dùng mã không chuẩn
  "flag_name" varchar(100),
  "register_id" varchar(50)
);
CREATE UNIQUE INDEX "ship_catalog_imo_number" ON "ship_catalog" ("imo_number") WHERE "imo_number" IS NOT NULL;
CREATE INDEX "ship_catalog_mmsi" ON "ship_catalog" ("mmsi") WHERE "mmsi" IS NOT NULL;
CREATE INDEX "ship_catalog_ship_name_trgm" ON "ship_catalog" USING GIN ("ship_name" gin_trgm_ops);

CREATE TABLE "ship_catalog_exname" (
  "source_id" BIGINT NOT NULL REFERENCES "ship_catalog" ("source_id") ON DELETE CASCADE,
  "name" varchar(255) NOT NULL
);
CREATE INDEX "ship_catalog_exname_source_id" ON "ship_catalog_exname" ("source_id");
CREATE INDEX "ship_catalog_exname_name_trgm" ON "ship_catalog_exname" USING GIN ("name" gin_trgm_ops);
