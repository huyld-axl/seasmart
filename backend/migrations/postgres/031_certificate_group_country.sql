-- Nhóm loại giấy chia theo LOẠI GIẤY, không theo nước cấp: Tuỳ thân, Chuyên môn, Huấn luyện STCW, Y tế, Khác.
-- Nước cấp (Việt Nam, Panama…) tách thành cột issuing_country_id; để trống = không gắn riêng một nước.
ALTER TABLE "certificate_type" ADD COLUMN IF NOT EXISTS "issuing_country_id" INTEGER REFERENCES "country" ("id");

UPDATE "certificate_type" SET issuing_country_id = (SELECT id FROM country WHERE code = 'PA') WHERE category = 'PANAMA';
UPDATE "certificate_type" SET issuing_country_id = (SELECT id FROM country WHERE code = 'VN') WHERE category = 'VN';

ALTER TABLE "certificate_type" DROP CONSTRAINT IF EXISTS "certificate_type_category_check";

-- Chuyên môn: bằng COC theo chức danh, bằng / chứng chỉ vô tuyến (GOC, ROC) và xác nhận của nước cờ.
UPDATE "certificate_type" SET category = 'COMPETENCY'
WHERE abbreviation IN ('COC', 'GOC', 'GOC ENDO', 'PANAMA COC', 'PANAMA GOC')
   OR code IN ('GMDSS-ROC', 'GMDSS-GOC', 'GOC', 'GOC_ENDO', 'PANAMA_COC', 'PANAMA_GOC',
               'COMPETENCY_DECK', 'COMPETENCY_ENGINE', 'COMPETENCY_RADIO',
               'MASTER', 'CHIEF-MATE', 'CHIEF-ENGINEER', 'SECOND-ENGINEER', 'OOW-DECK', 'OOW-ENGINE');
UPDATE "certificate_type" SET category = 'MEDICAL' WHERE code IN ('PANAMA_MEDICAL');
UPDATE "certificate_type" SET category = 'OTHER' WHERE code IN ('MARITIME_ENGLISH');
-- Phần còn lại của nhóm theo nước (huấn luyện tàu dầu, hoá chất, khí, khách, an ninh Panama…) là huấn luyện STCW.
UPDATE "certificate_type" SET category = 'STCW' WHERE category IN ('VN', 'PANAMA');

ALTER TABLE "certificate_type" ADD CONSTRAINT "certificate_type_category_check"
  CHECK ("category" IN ('DOCUMENT', 'COMPETENCY', 'STCW', 'MEDICAL', 'OTHER'));
