-- Bỏ lịch sử đi tàu khai tay / lấy từ sổ thuyền viên: chỉ còn chuyến tàu (seafarer_voyage) và nhật ký của chuyến.
DROP TABLE "sea_service";
DELETE FROM "role_permission" WHERE "permission" = 'seafarer.sea';
