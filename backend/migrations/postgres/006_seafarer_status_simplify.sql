-- Trạng thái thuyền viên chỉ còn ON_VESSEL (Đang trên tàu) và AVAILABLE (Ở bờ), đổi tự động theo chuyến tàu.
-- Các giá trị cũ (ON_LEAVE, TRAINING, BLACKLISTED, RETIRED, INACTIVE) đổi hết về AVAILABLE.
UPDATE "seafarer" SET "status" = 'AVAILABLE' WHERE "status" NOT IN ('ON_VESSEL', 'AVAILABLE');
