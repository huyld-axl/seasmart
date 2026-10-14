-- Bộ dữ liệu mẫu cho đội sales đi chào khách: ít bản ghi, mỗi bản ghi điền đủ thông tin.
--   2 chủ tàu, 4 tàu, 3 thuyền viên (kèm người thân, chứng chỉ, đi tàu, hợp đồng, lịch sử chức danh),
--   1 trung tâm đào tạo, 2 khóa học, 2 bộ giấy xuất.
-- Mọi tên người, công ty, tàu, số giấy tờ ở đây là tự đặt: CCCD bắt đầu 0000, SĐT 0900 000 xxx, email @example.com.
-- Số IMO đúng số kiểm tra nhưng không phải của tàu thật.
--
-- CẢNH BÁO: script XOÁ SẠCH dữ liệu nghiệp vụ (thuyền viên, giấy tờ đã tải, bộ giấy xuất, tàu, chủ tàu,
-- trung tâm, khóa học) rồi nạp lại. Giữ nguyên tài khoản đăng nhập và các danh mục chuẩn
-- (chức danh, loại chứng chỉ, loại tàu, quốc gia, cảng, loại hợp đồng, loại khóa học).
-- Thay cho migrations/011_seed_seafarer.sql (011 lấy từ file V-ISEA, tên có thể là thật).
--
-- Ngày hợp đồng và hạn giấy tờ tính theo ngày chạy script, nên chạy lại trước buổi demo để các cảnh báo còn đúng:
--   Trần Minh Khôi  đang trên tàu, hồ sơ sạch, xuất được mọi giấy
--   Lê Hoàng Nam    chờ tàu, sắp bay, có 1 chứng chỉ sắp hết hạn (trong 90 ngày)
--   Phạm Quốc Bảo   nghỉ phép, giấy khám sức khỏe đã hết hạn (bị chặn xuất), 1 chứng chỉ chờ duyệt
--
-- Chạy: mysql --default-character-set=utf8mb4 marineport < backend/scripts/seed_demo_synthetic.sql

SET NAMES utf8mb4;

-- ---------- 1. Xoá dữ liệu cũ (thứ tự theo khoá ngoại) ----------

DELETE FROM export_signature;
DELETE FROM export_pack_doc;
DELETE FROM export_pack;
DELETE FROM ai_call;
DELETE FROM document_field;
DELETE FROM sea_service;
DELETE FROM enrollment_score;
DELETE FROM enrollment_waitlist;
DELETE FROM training_enrollment;
DELETE FROM seafarer_certificate;
DELETE FROM seafarer_document;
DELETE FROM document_upload_page;
DELETE FROM document_upload;
DELETE FROM contract_payroll;
DELETE FROM employment_contract;
DELETE FROM seafarer_rank_history;
DELETE FROM seafarer_contact;
DELETE FROM seafarer_revision;
DELETE FROM qr_enrollment_link;
DELETE FROM training_course;
DELETE FROM training_center;
DELETE FROM vessel_certificate_requirement;
DELETE FROM vessel;
DELETE FROM ship_owner;
UPDATE `user` SET linked_entity_type = NULL, linked_entity_id = NULL WHERE linked_entity_type IN ('seafarer', 'training_center');
DELETE FROM seafarer;

-- Mã bộ giấy (B0001...) và id đếm lại từ 1.
ALTER TABLE export_pack AUTO_INCREMENT = 1;
ALTER TABLE export_pack_doc AUTO_INCREMENT = 1;
ALTER TABLE seafarer AUTO_INCREMENT = 1;
ALTER TABLE seafarer_contact AUTO_INCREMENT = 1;
ALTER TABLE seafarer_certificate AUTO_INCREMENT = 1;
ALTER TABLE seafarer_document AUTO_INCREMENT = 1;
ALTER TABLE document_upload AUTO_INCREMENT = 1;
ALTER TABLE sea_service AUTO_INCREMENT = 1;
ALTER TABLE employment_contract AUTO_INCREMENT = 1;
ALTER TABLE vessel AUTO_INCREMENT = 1;
ALTER TABLE ship_owner AUTO_INCREMENT = 1;
ALTER TABLE training_center AUTO_INCREMENT = 1;
ALTER TABLE training_course AUTO_INCREMENT = 1;
ALTER TABLE training_enrollment AUTO_INCREMENT = 1;

START TRANSACTION;

SET @today = CURDATE();
SET @admin = (SELECT MIN(id) FROM `user` WHERE role = 'admin' AND deleted_at IS NULL);
SET @vn = (SELECT id FROM country WHERE code = 'VN');
SET @cn = (SELECT id FROM country WHERE code = 'CN');
SET @pa = (SELECT id FROM country WHERE code = 'PA');
SET @hk = (SELECT id FROM country WHERE code = 'HK');

-- ---------- 2. Chủ tàu ----------

INSERT INTO ship_owner (
  code, company_name, company_name_en, country_id, address, phone, fax, email, website,
  contact_person, contact_phone, contact_email, tax_id, notes
) VALUES
('HLS', 'Công ty Cổ phần Vận tải biển Hải Long', 'Hai Long Shipping JSC', @vn,
 'Tầng 8, số 25 Điện Biên Phủ, phường Minh Khai, quận Hồng Bàng, Hải Phòng',
 '0225 000 0101', '0225 000 0102', 'info@hailong-shipping.example', 'https://hailong-shipping.example',
 'Nguyễn Thanh Tùng', '0900000101', 'crewing@hailong-shipping.example', '0200000001',
 'Chủ tàu trong nước, đội 2 tàu hàng khô chạy tuyến Đông Nam Á.'),
('EOS', 'Eastern Ocean Ship Management Co., Limited', 'Eastern Ocean Ship Management Co., Limited', @cn,
 'Room 1205, 12F, Harbour Tower, No. 88 Donghai West Road, Qingdao, Shandong, P.R. China',
 '+86 532 0000 0188', '+86 532 0000 0189', 'info@eastern-ocean.example', 'https://eastern-ocean.example',
 'Mr. Zhang Wei', '+86 130 0000 0188', 'crew@eastern-ocean.example', '91370200MA0000001X',
 'Chủ tàu Trung Quốc, nhận hồ sơ theo mẫu CV chủ tàu Trung Quốc.');

SET @hls = (SELECT id FROM ship_owner WHERE code = 'HLS');
SET @eos = (SELECT id FROM ship_owner WHERE code = 'EOS');

-- ---------- 3. Tàu ----------

INSERT INTO vessel (
  imo_number, mmsi, call_sign, vessel_name, vessel_name_prev, vessel_type_id, flag_country_id, port_of_registry_id,
  gross_tonnage, net_tonnage, deadweight, length_overall, year_built, classification_society,
  ship_owner_id, technical_manager, commercial_manager, status, notes
) VALUES
('9900019', '574000118', 'XVHL8', 'HAI LONG 18', 'OCEAN BREEZE', (SELECT id FROM vessel_type WHERE code = 'BULK'), @vn,
 (SELECT id FROM port WHERE un_locode = 'VNHPH'),
 17018.00, 10108.00, 28300.00, 169.37, 2009, 'VR',
 @hls, 'Hai Long Shipping JSC', 'Hai Long Shipping JSC', 'IN_SERVICE', 'Máy chính 5.850 kW. Tuyến Việt Nam - Indonesia - Philippines.'),
('9900021', '574000126', 'XVHL6', 'HAI LONG 26', NULL, (SELECT id FROM vessel_type WHERE code = 'GENERAL-CARGO'), @vn,
 (SELECT id FROM port WHERE un_locode = 'VNHPH'),
 8216.00, 5295.00, 12500.00, 136.40, 2011, 'VR',
 @hls, 'Hai Long Shipping JSC', 'Hai Long Shipping JSC', 'IN_SERVICE', 'Máy chính 3.310 kW. Tuyến nội địa và Đông Nam Á.'),
('9900033', '352000133', '3EEG3', 'EASTERN GRACE', NULL, (SELECT id FROM vessel_type WHERE code = 'BULK'), @pa,
 NULL,
 31540.00, 18765.00, 55800.00, 189.99, 2014, 'NK',
 @eos, 'Eastern Ocean Ship Management Co., Limited', 'Eastern Ocean Chartering Ltd.', 'IN_SERVICE', 'Máy chính 8.200 kW. Tuyến Trung Quốc - Úc - Nam Mỹ.'),
('9900045', '477000145', 'VREP5', 'EASTERN PEARL', 'PEARL RIVER 5', (SELECT id FROM vessel_type WHERE code = 'CONTAINER'), @hk,
 NULL,
 9610.00, 4680.00, 12700.00, 142.70, 2008, 'CCS',
 @eos, 'Eastern Ocean Ship Management Co., Limited', 'Eastern Ocean Chartering Ltd.', 'IN_SERVICE', 'Máy chính 7.200 kW, sức chở 1.050 TEU. Tuyến nội Á.');

SET @hl18 = (SELECT id FROM vessel WHERE imo_number = '9900019');
SET @hl26 = (SELECT id FROM vessel WHERE imo_number = '9900021');
SET @egrace = (SELECT id FROM vessel WHERE imo_number = '9900033');
SET @epearl = (SELECT id FROM vessel WHERE imo_number = '9900045');

-- ---------- 4. Thuyền viên ----------

INSERT INTO seafarer (
  seafarer_code, full_name, full_name_en, date_of_birth, place_of_birth, gender, nationality_id, ethnicity, religion,
  marital_status, children_count, children_info, children_ages,
  national_id, national_id_issued_date, national_id_issued_place,
  passport_number, passport_issued_date, passport_expiry,
  seaman_book_number, seaman_book_expiry, vietnam_registry_id,
  permanent_address, permanent_ward, permanent_district, permanent_province, contact_address,
  phone_primary, phone_secondary, email,
  height_cm, weight_kg, shirt_size, pants_size, shoe_size, blood_type,
  medical_cert_number, medical_cert_expiry,
  education_level, education_major, education_school, english_level, english_score,
  current_rank_id, rank_name_vi,
  bank_account_number, bank_account_holder, bank_name, bank_branch,
  social_insurance_number, social_insurance_joined, social_insurance_date,
  vessel_group, vessel_name_raw, contract_flight_date, contract_start_date, contract_duration_raw,
  contract_salary_raw, contract_end_date, contract_return_date,
  status, notes, created_by, updated_by
) VALUES
-- 1. Đại phó, đang trên tàu EASTERN GRACE, hồ sơ sạch
('DEMO-0001', 'Trần Minh Khôi', 'TRAN MINH KHOI', '1986-03-12', 'Hải Phòng', 'M', @vn, 'Kinh', 'Không',
 'Kết hôn', 2, 'Trần Minh Anh, Trần Gia Bảo', '9, 5',
 '000086000001', '2021-06-18', 'Cục Cảnh sát QLHC về TTXH',
 'D0000001', '2022-05-20', '2032-05-20',
 'VN900001-01', '2031-04-10', 'DKTV-900001',
 'Số 14 ngõ 62 Lạch Tray, phường Lạch Tray, quận Ngô Quyền, Hải Phòng', 'Phường Lạch Tray', 'Quận Ngô Quyền', 'Hải Phòng',
 'Số 14 ngõ 62 Lạch Tray, phường Lạch Tray, quận Ngô Quyền, Hải Phòng',
 '0900000001', '0900000011', 'khoi.tran@example.com',
 174, 72, 'L', '32', '42', 'O+',
 'GKSK-900001', DATE_ADD(@today, INTERVAL 14 MONTH),
 'Đại học', 'Điều khiển tàu biển', 'Trường Đại học Hàng hải Việt Nam', 'Marlins', 86,
 (SELECT id FROM `rank` WHERE code = 'CO'), 'Đại phó',
 '0000000100001', 'TRAN MINH KHOI', 'Vietcombank', 'Chi nhánh Hải Phòng',
 '0000900001', 1, '2010-09-01',
 'EOS', 'EASTERN GRACE', DATE_SUB(@today, INTERVAL 132 DAY), DATE_SUB(@today, INTERVAL 130 DAY), '9±1',
 4300.00, DATE_ADD(DATE_SUB(@today, INTERVAL 130 DAY), INTERVAL 9 MONTH), DATE_ADD(DATE_ADD(DATE_SUB(@today, INTERVAL 130 DAY), INTERVAL 9 MONTH), INTERVAL 3 DAY),
 'ON_VESSEL', 'Chuyến thứ hai trên EASTERN GRACE. Chủ tàu đánh giá tốt, đề nghị giữ cho hợp đồng sau.', @admin, @admin),
-- 2. Máy hai, chờ tàu, sắp bay sang nhận EASTERN PEARL
('DEMO-0002', 'Lê Hoàng Nam', 'LE HOANG NAM', '1989-07-30', 'Nam Định', 'M', @vn, 'Kinh', 'Không',
 'Kết hôn', 1, 'Lê Hoàng Minh', '4',
 '000089000002', '2022-03-09', 'Cục Cảnh sát QLHC về TTXH',
 'D0000002', '2023-02-15', '2033-02-15',
 'VN900002-01', '2030-11-22', 'DKTV-900002',
 'Xóm 5, xã Hải Minh, huyện Hải Hậu, Nam Định', 'Xã Hải Minh', 'Huyện Hải Hậu', 'Nam Định',
 'Số 8 Văn Cao, phường Đằng Giang, quận Ngô Quyền, Hải Phòng',
 '0900000002', '0900000012', 'nam.le@example.com',
 170, 68, 'M', '31', '41', 'A+',
 'GKSK-900002', DATE_ADD(@today, INTERVAL 11 MONTH),
 'Đại học', 'Khai thác máy tàu biển', 'Trường Đại học Hàng hải Việt Nam', 'Marlins', 78,
 (SELECT id FROM `rank` WHERE code = '2E'), 'Máy hai',
 '0000000100002', 'LE HOANG NAM', 'BIDV', 'Chi nhánh Nam Định',
 '0000900002', 1, '2013-08-01',
 'EOS', 'EASTERN PEARL', DATE_ADD(@today, INTERVAL 20 DAY), DATE_ADD(@today, INTERVAL 22 DAY), '9±1',
 3600.00, DATE_ADD(DATE_ADD(@today, INTERVAL 22 DAY), INTERVAL 9 MONTH), DATE_ADD(DATE_ADD(DATE_ADD(@today, INTERVAL 22 DAY), INTERVAL 9 MONTH), INTERVAL 3 DAY),
 'AVAILABLE', 'Đã trúng tuyển Máy hai tàu EASTERN PEARL, đang làm thủ tục lên tàu.', @admin, @admin),
-- 3. Thủy thủ trực ca, nghỉ phép, giấy khám sức khỏe hết hạn
('DEMO-0003', 'Phạm Quốc Bảo', 'PHAM QUOC BAO', '1995-01-19', 'Thái Bình', 'M', @vn, 'Kinh', 'Không',
 'Độc thân', 0, NULL, NULL,
 '000095000003', '2021-11-25', 'Cục Cảnh sát QLHC về TTXH',
 'D0000003', '2017-01-10', DATE_ADD(@today, INTERVAL 60 DAY),
 'VN900003-01', '2029-08-15', 'DKTV-900003',
 'Thôn Đông, xã Thụy Hải, huyện Thái Thụy, Thái Bình', 'Xã Thụy Hải', 'Huyện Thái Thụy', 'Thái Bình',
 'Thôn Đông, xã Thụy Hải, huyện Thái Thụy, Thái Bình',
 '0900000003', '0900000013', 'bao.pham@example.com',
 168, 63, 'M', '30', '40', 'B+',
 'GKSK-900003', DATE_SUB(@today, INTERVAL 20 DAY),
 'Cao đẳng', 'Điều khiển tàu biển', 'Trường Cao đẳng Hàng hải Đông Hải', 'Sơ cấp', 55,
 (SELECT id FROM `rank` WHERE code = 'AB'), 'Thủy thủ trực ca',
 '0000000100003', 'PHAM QUOC BAO', 'Agribank', 'Chi nhánh Thái Thụy',
 '0000900003', 1, '2018-06-01',
 'HLS', 'HAI LONG 26', DATE_SUB(@today, INTERVAL 422 DAY), DATE_SUB(@today, INTERVAL 420 DAY), '12±1',
 1450.00, DATE_SUB(@today, INTERVAL 40 DAY), DATE_SUB(@today, INTERVAL 38 DAY),
 'ON_LEAVE', 'Vừa rời tàu HAI LONG 26. Cần khám lại sức khỏe và gia hạn hộ chiếu trước chuyến tới.', @admin, @admin);

SET @s1 = (SELECT id FROM seafarer WHERE seafarer_code = 'DEMO-0001');
SET @s2 = (SELECT id FROM seafarer WHERE seafarer_code = 'DEMO-0002');
SET @s3 = (SELECT id FROM seafarer WHERE seafarer_code = 'DEMO-0003');

-- ---------- 5. Người thân: mỗi người một liên hệ khẩn cấp và một người bảo lãnh ----------

INSERT INTO seafarer_contact (
  seafarer_id, relationship, is_emergency_contact, is_guarantor, full_name, date_of_birth, national_id,
  phone_primary, phone_secondary, email, address, ward, district, province, occupation, workplace,
  guarantor_id_number, guarantor_id_issued_date, guarantor_id_issued_place
) VALUES
(@s1, 'Vợ', 1, 0, 'Nguyễn Thu Hà', '1988-10-05', '000188000101',
 '0900000021', NULL, 'ha.nguyen@example.com', 'Số 14 ngõ 62 Lạch Tray, phường Lạch Tray, quận Ngô Quyền, Hải Phòng',
 'Phường Lạch Tray', 'Quận Ngô Quyền', 'Hải Phòng', 'Giáo viên', 'Trường Tiểu học Lạch Tray', NULL, NULL, NULL),
(@s1, 'Bố', 0, 1, 'Trần Văn Thành', '1958-02-17', '000058000102',
 '0900000022', NULL, NULL, 'Số 3 Lê Lai, phường Máy Chai, quận Ngô Quyền, Hải Phòng',
 'Phường Máy Chai', 'Quận Ngô Quyền', 'Hải Phòng', 'Hưu trí', NULL, '000058000102', '2021-07-02', 'Cục Cảnh sát QLHC về TTXH'),
(@s2, 'Vợ', 1, 0, 'Vũ Thị Lan', '1991-04-22', '000191000201',
 '0900000023', NULL, 'lan.vu@example.com', 'Số 8 Văn Cao, phường Đằng Giang, quận Ngô Quyền, Hải Phòng',
 'Phường Đằng Giang', 'Quận Ngô Quyền', 'Hải Phòng', 'Kế toán', 'Công ty TNHH Thương mại Minh Phát', NULL, NULL, NULL),
(@s2, 'Anh trai', 0, 1, 'Lê Hoàng Sơn', '1985-12-03', '000085000202',
 '0900000024', NULL, NULL, 'Xóm 5, xã Hải Minh, huyện Hải Hậu, Nam Định',
 'Xã Hải Minh', 'Huyện Hải Hậu', 'Nam Định', 'Kinh doanh', 'Hộ kinh doanh Hoàng Sơn', '000085000202', '2022-01-14', 'Cục Cảnh sát QLHC về TTXH'),
(@s3, 'Mẹ', 1, 0, 'Đỗ Thị Hoa', '1968-08-30', '000168000301',
 '0900000025', NULL, NULL, 'Thôn Đông, xã Thụy Hải, huyện Thái Thụy, Thái Bình',
 'Xã Thụy Hải', 'Huyện Thái Thụy', 'Thái Bình', 'Làm nông', NULL, NULL, NULL, NULL),
(@s3, 'Bố', 0, 1, 'Phạm Văn Quang', '1965-05-11', '000065000302',
 '0900000026', NULL, NULL, 'Thôn Đông, xã Thụy Hải, huyện Thái Thụy, Thái Bình',
 'Xã Thụy Hải', 'Huyện Thái Thụy', 'Thái Bình', 'Ngư dân', NULL, '000065000302', '2021-09-20', 'Cục Cảnh sát QLHC về TTXH');

-- ---------- 6. Lịch sử chức danh ----------

INSERT INTO seafarer_rank_history (seafarer_id, rank_id, effective_date, end_date, notes) VALUES
(@s1, (SELECT id FROM `rank` WHERE code = '3O'), '2015-03-10', '2016-06-04', 'Lên Phó ba sau khi có GCNKNCM sỹ quan boong mức vận hành'),
(@s1, (SELECT id FROM `rank` WHERE code = '2O'), '2016-06-05', '2020-02-19', NULL),
(@s1, (SELECT id FROM `rank` WHERE code = 'CO'), '2020-02-20', NULL, 'Có GCNKNCM Đại phó tàu từ 3000 GT trở lên'),
(@s2, (SELECT id FROM `rank` WHERE code = '4E'), '2014-08-01', '2016-02-13', NULL),
(@s2, (SELECT id FROM `rank` WHERE code = '3E'), '2016-02-14', '2021-09-09', NULL),
(@s2, (SELECT id FROM `rank` WHERE code = '2E'), '2021-09-10', NULL, 'Có GCNKNCM Máy hai tàu từ 3000 kW trở lên'),
(@s3, (SELECT id FROM `rank` WHERE code = 'OS'), '2018-05-20', '2020-01-07', NULL),
(@s3, (SELECT id FROM `rank` WHERE code = 'AB'), '2020-01-08', NULL, 'Có chứng chỉ thủy thủ trực ca AB');

-- ---------- 7. Chứng chỉ ----------
-- Thuyền viên 1 và 2 còn hạn hết (xuất giấy được); thuyền viên 2 có 1 chứng chỉ hết hạn trong 45 ngày;
-- thuyền viên 3 có 1 chứng chỉ chờ duyệt.

INSERT INTO seafarer_certificate (
  seafarer_id, certificate_type_id, certificate_name_raw, certificate_number, issued_date, expiry_date, no_expiry,
  issued_by, issued_at_country_id, status, holder_name_raw, notes, created_by, updated_by
) VALUES
-- Trần Minh Khôi, Đại phó
(@s1, (SELECT id FROM certificate_type WHERE code = 'COMPETENCY_DECK'), 'GCNKNCM Đại phó tàu từ 3000 GT trở lên', 'CO-900001/CHHVN', '2023-08-15', '2028-08-15', 0, 'Cục Hàng hải Việt Nam', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW II/2', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'GOC'), 'Chứng chỉ khai thác viên GMDSS tổng quát (GOC)', 'GOC-900001/CHHVN', '2023-08-15', '2028-08-15', 0, 'Cục Hàng hải Việt Nam', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW IV/2', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'BASIC_TRAINING'), 'Huấn luyện an toàn cơ bản', 'BT-900001/DH', '2023-06-05', '2028-06-05', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/1', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'PSCRB'), 'Thành thạo bè cứu sinh, xuồng cứu nạn', 'SCRB-900001/DH', '2023-06-12', '2028-06-12', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/2-1', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'AFF'), 'Chữa cháy nâng cao', 'AFF-900001/DH', '2023-06-19', '2028-06-19', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/3', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'MFA'), 'Sơ cứu y tế', 'MFA-900001/DH', '2023-06-26', '2028-06-26', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/4-1', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'MC'), 'Chăm sóc y tế', 'MC-900001/DH', '2023-07-03', '2028-07-03', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/4-2', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'SSO'), 'Sỹ quan an ninh tàu biển', 'SSO-900001/DH', '2022-03-14', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/5, không thời hạn', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'SECURITY_DUTIES'), 'Thuyền viên có nhiệm vụ an ninh tàu biển cụ thể', 'SDSD-900001/DH', '2022-03-07', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', 'STCW VI/6-2, không thời hạn', @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'RADAR_OBSERVATION'), 'Quan sát và đồ giải Radar', 'RAD-900001/DH', '2022-04-11', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', NULL, @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'ARPA'), 'Thiết bị đồ giải radar tự động (ARPA)', 'ARPA-900001/DH', '2022-04-18', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', NULL, @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'ECDIS'), 'Hải đồ điện tử (ECDIS)', 'ECDIS-900001/DH', '2022-04-25', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'TRAN MINH KHOI', NULL, @admin, @admin),
(@s1, (SELECT id FROM certificate_type WHERE code = 'PANAMA_COC'), 'Panama Endorsement - Chief Mate', 'PA-CT-900001', '2023-09-20', '2028-08-15', 0, 'Panama Maritime Authority', @pa, 'VALID', 'TRAN MINH KHOI', 'Xác nhận công nhận GCNKNCM để làm việc trên tàu cờ Panama', @admin, @admin),
-- Lê Hoàng Nam, Máy hai
(@s2, (SELECT id FROM certificate_type WHERE code = 'COMPETENCY_ENGINE'), 'GCNKNCM Máy hai tàu từ 3000 kW trở lên', '2E-900002/CHHVN', '2024-03-11', '2029-03-11', 0, 'Cục Hàng hải Việt Nam', @vn, 'VALID', 'LE HOANG NAM', 'STCW III/2', @admin, @admin),
(@s2, (SELECT id FROM certificate_type WHERE code = 'BASIC_TRAINING'), 'Huấn luyện an toàn cơ bản', 'BT-900002/DH', '2024-01-08', '2029-01-08', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'LE HOANG NAM', 'STCW VI/1', @admin, @admin),
(@s2, (SELECT id FROM certificate_type WHERE code = 'PSCRB'), 'Thành thạo bè cứu sinh, xuồng cứu nạn', 'SCRB-900002/DH', '2024-01-15', '2029-01-15', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'LE HOANG NAM', 'STCW VI/2-1', @admin, @admin),
(@s2, (SELECT id FROM certificate_type WHERE code = 'AFF'), 'Chữa cháy nâng cao', 'AFF-900002/DH', DATE_SUB(DATE_ADD(@today, INTERVAL 45 DAY), INTERVAL 5 YEAR), DATE_ADD(@today, INTERVAL 45 DAY), 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'LE HOANG NAM', 'STCW VI/3. Sắp hết hạn, đã đăng ký khóa cập nhật.', @admin, @admin),
(@s2, (SELECT id FROM certificate_type WHERE code = 'MFA'), 'Sơ cứu y tế', 'MFA-900002/DH', '2024-01-22', '2029-01-22', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'LE HOANG NAM', 'STCW VI/4-1', @admin, @admin),
(@s2, (SELECT id FROM certificate_type WHERE code = 'SECURITY_DUTIES'), 'Thuyền viên có nhiệm vụ an ninh tàu biển cụ thể', 'SDSD-900002/DH', '2021-05-17', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'LE HOANG NAM', 'STCW VI/6-2, không thời hạn', @admin, @admin),
(@s2, (SELECT id FROM certificate_type WHERE code = 'ERM'), 'Quản lý nguồn lực buồng máy', 'ERM-900002/DH', '2021-05-24', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'LE HOANG NAM', NULL, @admin, @admin),
-- Phạm Quốc Bảo, Thủy thủ trực ca
(@s3, (SELECT id FROM certificate_type WHERE code = 'WATCHKEEPING-DECK'), 'GCNKNCM Thủy thủ trực ca AB', 'AB-900003/CHHVN', '2022-10-03', '2027-10-03', 0, 'Cục Hàng hải Việt Nam', @vn, 'VALID', 'PHAM QUOC BAO', 'STCW II/5', @admin, @admin),
(@s3, (SELECT id FROM certificate_type WHERE code = 'BASIC_TRAINING'), 'Huấn luyện an toàn cơ bản', 'BT-900003/DH', '2022-09-05', '2027-09-05', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'PHAM QUOC BAO', 'STCW VI/1', @admin, @admin),
(@s3, (SELECT id FROM certificate_type WHERE code = 'PSCRB'), 'Thành thạo bè cứu sinh, xuồng cứu nạn', 'SCRB-900003/DH', '2022-09-12', '2027-09-12', 0, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'PHAM QUOC BAO', 'STCW VI/2-1', @admin, @admin),
(@s3, (SELECT id FROM certificate_type WHERE code = 'SECURITY_AWARENESS'), 'Nhận thức an ninh tàu biển', 'SAT-900003/DH', '2018-04-09', NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'VALID', 'PHAM QUOC BAO', 'STCW VI/6-1, không thời hạn', @admin, @admin),
(@s3, (SELECT id FROM certificate_type WHERE code = 'SECURITY_DUTIES'), 'Thuyền viên có nhiệm vụ an ninh tàu biển cụ thể', 'SDSD-900003/DH', DATE_SUB(@today, INTERVAL 12 DAY), NULL, 1, 'Trung tâm Huấn luyện Hàng hải Đông Hải', @vn, 'PENDING', 'PHAM QUOC BAO', 'Thuyền viên vừa gửi bản chụp, chờ đối chiếu bản gốc.', @admin, @admin);

-- ---------- 8. Quá trình đi tàu (không chuyến nào trùng ngày) ----------

INSERT INTO sea_service (
  seafarer_id, source_type, vessel_name_raw, vessel_type_raw, flag_raw, gross_tonnage_raw, engine_power_raw, owner_raw,
  vessel_id, vessel_match_status, rank_raw, rank_id, coc_number,
  sign_on_date, sign_on_port, sign_off_date, sign_off_port, notes, created_by, updated_by
) VALUES
-- Trần Minh Khôi
(@s1, 'MANUAL', 'HAI LONG 26', 'General Cargo', 'Vietnam', '8216', '3310', 'Hai Long Shipping JSC',
 @hl26, 'MATCHED', '3/O', (SELECT id FROM `rank` WHERE code = '3O'), 'OOW-900001/CHHVN',
 '2015-03-10', 'Hải Phòng, Việt Nam', '2016-01-22', 'Singapore', 'South East Asia', @admin, @admin),
(@s1, 'MANUAL', 'OCEAN HARMONY', 'Bulk Carrier', 'Panama', '22850', '6480', 'Harmony Maritime S.A.',
 NULL, 'NOT_FOUND', '2/O', (SELECT id FROM `rank` WHERE code = '2O'), 'OOW-900001/CHHVN',
 '2016-06-05', 'Kaohsiung, Taiwan', '2017-04-18', 'Manila, Philippines', 'Far East - Australia', @admin, @admin),
(@s1, 'MANUAL', 'HAI LONG 18', 'Bulk Carrier', 'Vietnam', '17018', '5850', 'Hai Long Shipping JSC',
 @hl18, 'MATCHED', '2/O', (SELECT id FROM `rank` WHERE code = '2O'), 'OOW-900001/CHHVN',
 '2018-01-15', 'Quảng Ninh, Việt Nam', '2018-11-30', 'Hải Phòng, Việt Nam', 'South East Asia', @admin, @admin),
(@s1, 'MANUAL', 'EASTERN PEARL', 'Container', 'Hong Kong', '9610', '7200', 'Eastern Ocean Ship Management Co., Limited',
 @epearl, 'MATCHED', 'C/O', (SELECT id FROM `rank` WHERE code = 'CO'), 'CO-800001/CHHVN',
 '2020-02-20', 'Hong Kong', '2020-12-08', 'Shanghai, China', 'Intra-Asia', @admin, @admin),
(@s1, 'MANUAL', 'EASTERN GRACE', 'Bulk Carrier', 'Panama', '31540', '8200', 'Eastern Ocean Ship Management Co., Limited',
 @egrace, 'MATCHED', 'C/O', (SELECT id FROM `rank` WHERE code = 'CO'), 'CO-800001/CHHVN',
 '2022-05-12', 'Qingdao, China', '2023-03-25', 'Newcastle, Australia', 'Worldwide', @admin, @admin),
(@s1, 'MANUAL', 'EASTERN GRACE', 'Bulk Carrier', 'Panama', '31540', '8200', 'Eastern Ocean Ship Management Co., Limited',
 @egrace, 'MATCHED', 'C/O', (SELECT id FROM `rank` WHERE code = 'CO'), 'CO-900001/CHHVN',
 DATE_SUB(@today, INTERVAL 130 DAY), 'Qingdao, China', NULL, NULL, 'Worldwide. Đang trên tàu.', @admin, @admin),
-- Lê Hoàng Nam
(@s2, 'MANUAL', 'HAI LONG 26', 'General Cargo', 'Vietnam', '8216', '3310', 'Hai Long Shipping JSC',
 @hl26, 'MATCHED', '4/E', (SELECT id FROM `rank` WHERE code = '4E'), 'OEW-900002/CHHVN',
 '2014-08-01', 'Hải Phòng, Việt Nam', '2015-06-20', 'Hải Phòng, Việt Nam', 'South East Asia', @admin, @admin),
(@s2, 'MANUAL', 'HAI LONG 18', 'Bulk Carrier', 'Vietnam', '17018', '5850', 'Hai Long Shipping JSC',
 @hl18, 'MATCHED', '3/E', (SELECT id FROM `rank` WHERE code = '3E'), 'OEW-900002/CHHVN',
 '2016-02-14', 'Quảng Ninh, Việt Nam', '2017-01-09', 'Cebu, Philippines', 'South East Asia', @admin, @admin),
(@s2, 'MANUAL', 'EASTERN PEARL', 'Container', 'Hong Kong', '9610', '7200', 'Eastern Ocean Ship Management Co., Limited',
 @epearl, 'MATCHED', '3/E', (SELECT id FROM `rank` WHERE code = '3E'), 'OEW-900002/CHHVN',
 '2018-04-03', 'Hong Kong', '2019-02-27', 'Busan, Korea', 'Intra-Asia', @admin, @admin),
(@s2, 'MANUAL', 'EASTERN GRACE', 'Bulk Carrier', 'Panama', '31540', '8200', 'Eastern Ocean Ship Management Co., Limited',
 @egrace, 'MATCHED', '2/E', (SELECT id FROM `rank` WHERE code = '2E'), '2E-800002/CHHVN',
 '2021-09-10', 'Qingdao, China', '2022-07-22', 'Santos, Brazil', 'Worldwide', @admin, @admin),
(@s2, 'MANUAL', 'HAI LONG 18', 'Bulk Carrier', 'Vietnam', '17018', '5850', 'Hai Long Shipping JSC',
 @hl18, 'MATCHED', '2/E', (SELECT id FROM `rank` WHERE code = '2E'), '2E-900002/CHHVN',
 DATE_SUB(@today, INTERVAL 390 DAY), 'Hải Phòng, Việt Nam', DATE_SUB(@today, INTERVAL 65 DAY), 'Quảng Ninh, Việt Nam', 'South East Asia', @admin, @admin),
-- Phạm Quốc Bảo
(@s3, 'MANUAL', 'HAI LONG 26', 'General Cargo', 'Vietnam', '8216', '3310', 'Hai Long Shipping JSC',
 @hl26, 'MATCHED', 'OS', (SELECT id FROM `rank` WHERE code = 'OS'), NULL,
 '2018-05-20', 'Hải Phòng, Việt Nam', '2019-03-11', 'Đà Nẵng, Việt Nam', 'Việt Nam - Đông Nam Á', @admin, @admin),
(@s3, 'MANUAL', 'EASTERN PEARL', 'Container', 'Hong Kong', '9610', '7200', 'Eastern Ocean Ship Management Co., Limited',
 @epearl, 'MATCHED', 'AB', (SELECT id FROM `rank` WHERE code = 'AB'), 'AB-800003/CHHVN',
 '2020-01-08', 'Hong Kong', '2020-11-19', 'Kaohsiung, Taiwan', 'Intra-Asia', @admin, @admin),
(@s3, 'MANUAL', 'HAI LONG 26', 'General Cargo', 'Vietnam', '8216', '3310', 'Hai Long Shipping JSC',
 @hl26, 'MATCHED', 'AB', (SELECT id FROM `rank` WHERE code = 'AB'), 'AB-900003/CHHVN',
 DATE_SUB(@today, INTERVAL 420 DAY), 'Hải Phòng, Việt Nam', DATE_SUB(@today, INTERVAL 40 DAY), 'Hải Phòng, Việt Nam', 'Việt Nam - Đông Nam Á', @admin, @admin);

-- ---------- 9. Hợp đồng ----------

INSERT INTO employment_contract (
  contract_number, seafarer_id, vessel_id, ship_owner_id, contract_type_id, rank_id,
  sign_date, start_date, end_date, actual_end_date, duration_months, sign_on_port_id, sign_off_port_id,
  basic_wage_usd, overtime_rate_usd, leave_pay_usd, subsistence_usd, total_monthly_usd,
  p_and_i_club, insurance_policy_number, life_insurance_usd,
  agency_fee_usd, visa_fee_usd, medical_fee_usd, training_fee_usd, total_cost_usd, status, notes
) VALUES
('HD-DEMO-2022-001', @s1, @egrace, @eos, (SELECT id FROM contract_type WHERE code = 'SHORT_TERM'), (SELECT id FROM `rank` WHERE code = 'CO'),
 '2022-05-02', '2022-05-12', '2023-03-12', '2023-03-25', 10, NULL, NULL,
 4100.00, 12.50, 410.00, 150.00, 5200.00, 'Japan P&I Club', 'PI-DEMO-22001', 100000.00,
 300.00, 120.00, 80.00, 0.00, 500.00, 'COMPLETED', 'Chuyến đầu trên EASTERN GRACE, hoàn thành đúng hạn.'),
(CONCAT('HD-DEMO-', YEAR(DATE_SUB(@today, INTERVAL 130 DAY)), '-002'), @s1, @egrace, @eos, (SELECT id FROM contract_type WHERE code = 'SHORT_TERM'), (SELECT id FROM `rank` WHERE code = 'CO'),
 DATE_SUB(@today, INTERVAL 140 DAY), DATE_SUB(@today, INTERVAL 130 DAY), DATE_ADD(DATE_SUB(@today, INTERVAL 130 DAY), INTERVAL 9 MONTH), NULL, 9, NULL, NULL,
 4300.00, 13.00, 430.00, 150.00, 5450.00, 'Japan P&I Club', 'PI-DEMO-26002', 100000.00,
 300.00, 120.00, 80.00, 0.00, 500.00, 'ACTIVE', 'Hợp đồng 9±1 tháng, đang thực hiện.'),
(CONCAT('HD-DEMO-', YEAR(DATE_SUB(@today, INTERVAL 390 DAY)), '-003'), @s2, @hl18, @hls, (SELECT id FROM contract_type WHERE code = 'SHORT_TERM'), (SELECT id FROM `rank` WHERE code = '2E'),
 DATE_SUB(@today, INTERVAL 400 DAY), DATE_SUB(@today, INTERVAL 390 DAY), DATE_SUB(@today, INTERVAL 60 DAY), DATE_SUB(@today, INTERVAL 65 DAY), 11,
 (SELECT id FROM port WHERE un_locode = 'VNHPH'), NULL,
 3300.00, 10.00, 330.00, 120.00, 4150.00, 'West of England P&I', 'PI-DEMO-25003', 80000.00,
 0.00, 0.00, 60.00, 0.00, 60.00, 'COMPLETED', 'Hoàn thành, đã thanh lý hợp đồng.'),
(CONCAT('HD-DEMO-', YEAR(@today), '-004'), @s2, @epearl, @eos, (SELECT id FROM contract_type WHERE code = 'SHORT_TERM'), (SELECT id FROM `rank` WHERE code = '2E'),
 DATE_SUB(@today, INTERVAL 5 DAY), DATE_ADD(@today, INTERVAL 22 DAY), DATE_ADD(DATE_ADD(@today, INTERVAL 22 DAY), INTERVAL 9 MONTH), NULL, 9, NULL, NULL,
 3600.00, 11.00, 360.00, 150.00, 4600.00, 'Japan P&I Club', 'PI-DEMO-26004', 100000.00,
 300.00, 120.00, 80.00, 150.00, 650.00, 'SIGNED', 'Đã ký, chờ bay sang nhận tàu.'),
(CONCAT('HD-DEMO-', YEAR(DATE_SUB(@today, INTERVAL 420 DAY)), '-005'), @s3, @hl26, @hls, (SELECT id FROM contract_type WHERE code = 'LONG_TERM'), (SELECT id FROM `rank` WHERE code = 'AB'),
 DATE_SUB(@today, INTERVAL 430 DAY), DATE_SUB(@today, INTERVAL 420 DAY), DATE_SUB(@today, INTERVAL 55 DAY), DATE_SUB(@today, INTERVAL 40 DAY), 12,
 (SELECT id FROM port WHERE un_locode = 'VNHPH'), (SELECT id FROM port WHERE un_locode = 'VNHPH'),
 1450.00, 5.50, 145.00, 100.00, 1850.00, 'West of England P&I', 'PI-DEMO-25005', 50000.00,
 0.00, 0.00, 60.00, 0.00, 60.00, 'COMPLETED', 'Hoàn thành, thuyền viên về nghỉ phép.');

-- ---------- 10. Đào tạo ----------

INSERT INTO training_center (
  code, name_vi, name_en, country_id, license_number, license_expiry, accredited_by,
  address, phone, email, contact_person, notes, created_by, updated_by
) VALUES
('TT-DONGHAI', 'Trung tâm Huấn luyện Hàng hải Đông Hải', 'Dong Hai Maritime Training Center', @vn,
 'GCN-DEMO-0001', DATE_ADD(@today, INTERVAL 3 YEAR), 'Cục Hàng hải Việt Nam',
 'Số 120 Lê Thánh Tông, phường Máy Chai, quận Ngô Quyền, Hải Phòng', '0225 000 0201', 'daotao@donghai-mtc.example',
 'Phạm Thị Mai', 'Huấn luyện nghiệp vụ STCW cho sỹ quan và thuyền viên.', @admin, @admin);

SET @center = (SELECT id FROM training_center WHERE code = 'TT-DONGHAI');

INSERT INTO training_course (
  course_code, course_type_id, training_center_id, name, start_date, end_date, location,
  max_students, fee_vnd, fee_usd, instructor, status, notes, created_by, updated_by
) VALUES
('DH-BT-01', (SELECT id FROM course_type WHERE code = 'CT-STCW-BASIC'), @center, 'Huấn luyện an toàn cơ bản (cập nhật) - Khóa 01',
 DATE_SUB(@today, INTERVAL 75 DAY), DATE_SUB(@today, INTERVAL 70 DAY), 'Cơ sở Hải Phòng',
 25, 3500000.00, 140.00, 'Thuyền trưởng Đặng Văn Hùng', 'COMPLETED', 'Đã kết thúc và cấp chứng chỉ.', @admin, @admin),
('DH-AFF-02', (SELECT id FROM course_type WHERE code = 'CT-AFF'), @center, 'Chữa cháy nâng cao (cập nhật) - Khóa 02',
 DATE_ADD(@today, INTERVAL 7 DAY), DATE_ADD(@today, INTERVAL 11 DAY), 'Cơ sở Hải Phòng',
 20, 4200000.00, 170.00, 'Máy trưởng Bùi Quang Vinh', 'PLANNED', 'Khóa cập nhật 5 năm cho chứng chỉ sắp hết hạn.', @admin, @admin);

INSERT INTO training_enrollment (
  course_id, seafarer_id, enrollment_date, rank_at_enrollment,
  attendance_score, attendance_max, process_score, interview_score, total_score, grade, result,
  certificate_issued, notes, status, approved_by, approved_at, referred_by_center_id, created_by, updated_by
) VALUES
((SELECT id FROM training_course WHERE course_code = 'DH-BT-01'), @s2, DATE_SUB(@today, INTERVAL 85 DAY), (SELECT id FROM `rank` WHERE code = '2E'),
 25.00, 25, 34.00, 31.00, 90.00, 'A', 'PASS',
 1, 'Hoàn thành tốt, đã nhận chứng chỉ.', 'COMPLETED', @admin, DATE_SUB(@today, INTERVAL 84 DAY), @center, @admin, @admin),
((SELECT id FROM training_course WHERE course_code = 'DH-AFF-02'), @s2, DATE_SUB(@today, INTERVAL 3 DAY), (SELECT id FROM `rank` WHERE code = '2E'),
 NULL, 25, NULL, NULL, NULL, NULL, NULL,
 0, 'Học cập nhật trước khi chứng chỉ chữa cháy nâng cao hết hạn.', 'APPROVED', @admin, DATE_SUB(@today, INTERVAL 2 DAY), @center, @admin, @admin),
((SELECT id FROM training_course WHERE course_code = 'DH-AFF-02'), @s3, DATE_SUB(@today, INTERVAL 1 DAY), (SELECT id FROM `rank` WHERE code = 'AB'),
 NULL, 25, NULL, NULL, NULL, NULL, NULL,
 0, 'Đăng ký trong thời gian nghỉ phép.', 'PENDING', NULL, NULL, @center, @admin, @admin);

-- ---------- 11. Bộ giấy xuất (cần có tài khoản admin; chưa có thì bỏ qua phần này) ----------

INSERT INTO export_pack (seafarer_id, ship_owner_id, title, status, inputs, edits, snapshot, created_by, created_at)
SELECT @s2, @eos, 'Bộ giấy tuyển dụng', 'DONE',
       JSON_OBJECT('Ngày có mặt', DATE_FORMAT(DATE_ADD(@today, INTERVAL 15 DAY), '%d/%m/%Y'), 'Số tiền', '5.000.000', 'Lý do thu', 'Thu phí làm hộ chiếu, visa và khám sức khỏe'),
       '{}',
       JSON_OBJECT('full_name', 'Lê Hoàng Nam', 'date_of_birth', '1989-07-30', 'rank_name', 'Máy hai'),
       @admin, DATE_SUB(NOW(), INTERVAL 6 DAY)
WHERE @admin IS NOT NULL;
SET @pack1 = LAST_INSERT_ID();

INSERT INTO export_pack_doc (pack_id, template_key, sort_order)
SELECT @pack1, k.template_key, k.sort_order
FROM (SELECT 'kq' AS template_key, 0 AS sort_order UNION ALL SELECT 'tb', 1 UNION ALL SELECT 'cv', 2 UNION ALL SELECT 'pt', 3) k
WHERE @admin IS NOT NULL;

INSERT INTO export_pack (seafarer_id, ship_owner_id, title, status, inputs, edits, snapshot, created_by, created_at)
SELECT @s2, @eos, 'Bộ giấy lên tàu', 'DONE',
       JSON_OBJECT('Tên tàu', 'EASTERN PEARL', 'Ngày xuống tàu', DATE_FORMAT(DATE_ADD(@today, INTERVAL 22 DAY), '%d/%m/%Y'), 'Mức đóng', '5.000.000 đồng/tháng',
                   'Người được ủy quyền', 'Vũ Thị Lan', 'Người nhận lương', 'Vũ Thị Lan'),
       '{}',
       JSON_OBJECT('full_name', 'Lê Hoàng Nam', 'date_of_birth', '1989-07-30', 'rank_name', 'Máy hai'),
       @admin, DATE_SUB(NOW(), INTERVAL 1 DAY)
WHERE @admin IS NOT NULL;
SET @pack2 = LAST_INSERT_ID();

INSERT INTO export_pack_doc (pack_id, template_key, sort_order)
SELECT @pack2, k.template_key, k.sort_order
FROM (SELECT 'qddd' AS template_key, 0 AS sort_order UNION ALL SELECT 'bhxh', 1 UNION ALL SELECT 'bl', 2 UNION ALL SELECT 'uqcn', 3 UNION ALL SELECT 'uql', 4) k
WHERE @admin IS NOT NULL;

-- ---------- 12. Lịch sử sửa hồ sơ ----------

INSERT INTO seafarer_revision (seafarer_id, changed_by, reason, changes, created_at) VALUES
(@s1, @admin, 'Cập nhật theo hộ chiếu mới cấp', JSON_OBJECT('passport_number', JSON_ARRAY('C0000001', 'D0000001'), 'passport_issued_date', JSON_ARRAY('2017-05-18', '2022-05-20')), DATE_SUB(NOW(), INTERVAL 150 DAY)),
(@s2, @admin, 'Thuyền viên báo đổi số điện thoại', JSON_OBJECT('phone_primary', JSON_ARRAY('0900000092', '0900000002')), DATE_SUB(NOW(), INTERVAL 30 DAY)),
(@s2, @admin, 'Trúng tuyển Máy hai tàu EASTERN PEARL', JSON_OBJECT('vessel_name_raw', JSON_ARRAY('HAI LONG 18', 'EASTERN PEARL'), 'contract_salary_raw', JSON_ARRAY('3300.00', '3600.00')), DATE_SUB(NOW(), INTERVAL 6 DAY)),
(@s3, @admin, 'Rời tàu HAI LONG 26, về nghỉ phép', JSON_OBJECT('status', JSON_ARRAY('ON_VESSEL', 'ON_LEAVE')), DATE_SUB(NOW(), INTERVAL 40 DAY));

COMMIT;
