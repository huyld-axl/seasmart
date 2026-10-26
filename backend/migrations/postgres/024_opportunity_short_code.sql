-- Mã cơ hội ngắn lại: CH-2026-047 -> CH26047. Chỉ đổi mã đã có; nơi khác tham chiếu cơ hội bằng id.
UPDATE "opportunity" SET "code" = 'CH' || substr("code", 6, 2) || substr("code", 9)
WHERE "code" ~ '^CH-[0-9]{4}-[0-9]+$';
