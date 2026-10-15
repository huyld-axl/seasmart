-- Màn Master Tàu: thêm thông tin kỹ thuật. Trạng thái tàu chuyển sang bốn giá trị
-- ACTIVE (Hoạt động), LAID_UP (Nằm bờ), UNDER_CONSTRUCTION (Đang đóng), SCRAPPED (Phá dỡ).
ALTER TABLE "vessel"
  ADD COLUMN "engine_power_kw" decimal(10,2),
  ADD COLUMN "engine_type" varchar(100),
  ADD COLUMN "dp_class" varchar(10),
  ADD COLUMN "class_status" varchar(20),
  ADD COLUMN "passenger_capacity" INTEGER,
  ADD COLUMN "crew_capacity" INTEGER,
  ADD COLUMN "has_boiler" SMALLINT DEFAULT 0 NOT NULL,
  ADD COLUMN "has_refrigeration" SMALLINT DEFAULT 0 NOT NULL;

ALTER TABLE "vessel"
  ADD CONSTRAINT "vessel_has_boiler_check" CHECK ("has_boiler" IN (0, 1)),
  ADD CONSTRAINT "vessel_has_refrigeration_check" CHECK ("has_refrigeration" IN (0, 1)),
  ADD CONSTRAINT "vessel_dp_class_check" CHECK ("dp_class" IS NULL OR "dp_class" IN ('NONE', 'DP1', 'DP2', 'DP3')),
  ADD CONSTRAINT "vessel_class_status_check" CHECK ("class_status" IS NULL OR "class_status" IN ('IN_CLASS', 'SUSPENDED', 'WITHDRAWN', 'UNCLASSED'));

UPDATE "vessel" SET "status" = 'ACTIVE'
WHERE "status" NOT IN ('ACTIVE', 'LAID_UP', 'UNDER_CONSTRUCTION', 'SCRAPPED');

ALTER TABLE "vessel" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
ALTER TABLE "vessel"
  ADD CONSTRAINT "vessel_status_check" CHECK ("status" IN ('ACTIVE', 'LAID_UP', 'UNDER_CONSTRUCTION', 'SCRAPPED'));
