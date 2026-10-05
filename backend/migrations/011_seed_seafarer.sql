-- Seed dữ liệu mẫu bảng seafarer
-- Nguồn: HD - Hong.xlsx (sheet "data") - V-ISEA Vietnam
-- Ghi chú: nationality_id=1 (VN), current_rank_id theo bảng rank đã seed
-- Chạy sau: 001_seed_rank.sql, 007_seed_country.sql, 003_seafarer_extra_cols.sql

SET NAMES utf8mb4;

-- Lấy rank_id theo code (dùng subquery để không phụ thuộc vào auto_increment id)
INSERT INTO seafarer (
  seafarer_code, full_name, full_name_en,
  date_of_birth, gender, nationality_id,
  national_id, national_id_issued_date, national_id_issued_place,
  passport_number, passport_issued_date, passport_expiry,
  phone_primary,
  permanent_address, permanent_ward, permanent_district, permanent_province,
  bank_account_number, bank_name, bank_account_holder,
  social_insurance_number, social_insurance_joined,
  marital_status, children_count, children_info, children_ages,
  height_cm, weight_kg, shirt_size, pants_size,
  current_rank_id, rank_name_vi,
  vessel_group, vessel_name_raw,
  contract_flight_date, contract_start_date, contract_duration_raw,
  contract_salary_raw, contract_end_date, contract_return_date,
  status, notes
) VALUES
-- 1. Đào Hoàng Hiệp - 3E, tàu POCAHONTAS, khối SEC
(
  '20230064', 'ĐÀO HOÀNG HIỆP', 'DAO HOANG HIEP',
  '1990-05-14', 'M', (SELECT id FROM country WHERE code='VN'),
  '031090001234', '2021-03-10', 'Hải Phòng',
  'B5123456', '2022-01-15', '2027-01-14',
  '0912345678',
  '45 Lê Lợi', 'Phường Máy Tơ', 'Ngô Quyền', 'Hải Phòng',
  '0123456789012', 'Vietcombank', 'ĐÀO HOÀNG HIỆP',
  '1234567890', 1,
  'Kết hôn', 1, 'Đào Hoàng Minh', '3',
  172, 68, 'L', '32',
  (SELECT id FROM `rank` WHERE code='3E'), 'Máy ba',
  'SEC', 'POCAHONTAS',
  '2023-04-10', '2023-04-12', '10±2',
  3100.00, '2024-02-12', '2024-02-18',
  'ON_VESSEL', NULL
),
-- 2. Nguyễn Minh Hoàng - 4E, tàu POCAHONTAS, khối SEC
(
  '20230065', 'NGUYỄN MINH HOÀNG', 'NGUYEN MINH HOANG',
  '1995-08-22', 'M', (SELECT id FROM country WHERE code='VN'),
  '036095002345', '2020-06-20', 'TP. Hồ Chí Minh',
  'B6234567', '2021-09-01', '2026-08-31',
  '0987654321',
  '12 Nguyễn Trãi', 'Phường 3', 'Quận 5', 'TP. Hồ Chí Minh',
  '9876543210123', 'Techcombank', 'NGUYỄN MINH HOÀNG',
  '2345678901', 1,
  'Độc thân', 0, NULL, NULL,
  170, 65, 'M', '30',
  (SELECT id FROM `rank` WHERE code='4E'), 'Máy tư',
  'SEC', 'POCAHONTAS',
  '2023-04-10', '2023-04-12', '10±2',
  2650.00, '2024-02-12', '2024-02-20',
  'ON_VESSEL', NULL
),
-- 3. Vũ Văn Đông - 2E, tàu POCAHONTAS, khối SEC
(
  '20230063', 'VŨ VĂN ĐÔNG', 'VU VAN DONG',
  '1985-11-03', 'M', (SELECT id FROM country WHERE code='VN'),
  '027085003456', '2019-04-05', 'Nam Định',
  'B4345678', '2020-07-10', '2025-07-09',
  '0934567890',
  '78 Trần Phú', 'Xã Mỹ Tân', 'Mỹ Lộc', 'Nam Định',
  '1122334455667', 'BIDV', 'VŨ VĂN ĐÔNG',
  '3456789012', 1,
  'Kết hôn', 2, 'Vũ Văn An, Vũ Thị Bình', '8, 5',
  175, 72, 'XL', '34',
  (SELECT id FROM `rank` WHERE code='2E'), 'Máy hai',
  'SEC', 'POCAHONTAS',
  '2023-04-10', '2023-04-12', '10±2',
  3500.00, '2024-02-12', '2024-02-22',
  'ON_VESSEL', NULL
),
-- 4. Trần Thị Lan - COOK, tàu STAR QUEEN, khối FEI
(
  '20230070', 'TRẦN THỊ LAN', 'TRAN THI LAN',
  '1992-03-17', 'F', (SELECT id FROM country WHERE code='VN'),
  '001092004567', '2022-08-15', 'Hà Nội',
  'C1456789', '2023-02-20', '2028-02-19',
  '0901234567',
  '23 Hoàng Hoa Thám', 'Phường Ngọc Hà', 'Ba Đình', 'Hà Nội',
  '5544332211009', 'Agribank', 'TRẦN THỊ LAN',
  '4567890123', 1,
  'Kết hôn', 1, 'Nguyễn Văn Tú', '4',
  158, 52, 'S', '26',
  (SELECT id FROM `rank` WHERE code='COOK'), 'Bếp trưởng',
  'FEI', 'STAR QUEEN',
  '2023-06-01', '2023-06-03', '12±2',
  1800.00, '2024-06-03', '2024-06-10',
  'ON_VESSEL', NULL
),
-- 5. Lê Quang Hùng - CO, tàu PACIFIC GLORY, khối ASL
(
  '20220045', 'LÊ QUANG HÙNG', 'LE QUANG HUNG',
  '1982-07-28', 'M', (SELECT id FROM country WHERE code='VN'),
  '040082005678', '2018-11-20', 'Đà Nẵng',
  'A9567890', '2019-05-05', '2024-05-04',
  '0905678901',
  '56 Phan Châu Trinh', 'Phường Hải Châu 1', 'Hải Châu', 'Đà Nẵng',
  '6677889900112', 'MB Bank', 'LÊ QUANG HÙNG',
  '5678901234', 1,
  'Kết hôn', 2, 'Lê Thị Hoa, Lê Văn Minh', '12, 9',
  178, 75, 'XL', '34',
  (SELECT id FROM `rank` WHERE code='CO'), 'Đại phó',
  'ASL', 'PACIFIC GLORY',
  '2023-03-15', '2023-03-17', '9±1',
  4300.00, '2023-12-17', '2023-12-25',
  'AVAILABLE', 'Về phép, sẵn sàng nhận tàu mới'
),
-- 6. Phạm Văn Tùng - AB, tàu OCEAN STAR, khối SEC
(
  '20230080', 'PHẠM VĂN TÙNG', 'PHAM VAN TUNG',
  '1998-12-05', 'M', (SELECT id FROM country WHERE code='VN'),
  '033098006789', '2023-01-10', 'Quảng Ninh',
  'D2678901', '2023-03-01', '2028-02-28',
  '0978901234',
  '89 Trần Quốc Toản', 'Phường Hồng Hải', 'Hạ Long', 'Quảng Ninh',
  '7788990011223', 'VPBank', 'PHẠM VĂN TÙNG',
  '6789012345', 0,
  'Độc thân', 0, NULL, NULL,
  168, 62, 'M', '30',
  (SELECT id FROM `rank` WHERE code='AB'), 'Thủy thủ trực ca',
  'SEC', 'OCEAN STAR',
  '2023-07-20', '2023-07-22', '10±2',
  1400.00, '2024-05-22', '2024-05-28',
  'ON_VESSEL', NULL
),
-- 7. Hoàng Văn Nam - CE, tàu PACIFIC GLORY, khối ASL
(
  '20210030', 'HOÀNG VĂN NAM', 'HOANG VAN NAM',
  '1978-04-12', 'M', (SELECT id FROM country WHERE code='VN'),
  '026078007890', '2017-06-15', 'Hải Phòng',
  'A7789012', '2018-08-20', '2023-08-19',
  '0916789012',
  '34 Điện Biên Phủ', 'Phường Minh Khai', 'Hồng Bàng', 'Hải Phòng',
  '8899001122334', 'Vietinbank', 'HOÀNG VĂN NAM',
  '7890123456', 1,
  'Kết hôn', 3, 'Hoàng Thị Mai, Hoàng Văn Đức, Hoàng Văn Khoa', '18, 15, 10',
  176, 78, 'XL', '34',
  (SELECT id FROM `rank` WHERE code='CE'), 'Máy trưởng',
  'ASL', 'PACIFIC GLORY',
  '2023-03-15', '2023-03-17', '9±1',
  5500.00, '2023-12-17', '2023-12-28',
  'TRAINING', 'Đang học khóa nâng cao chứng chỉ STCW'
),
-- 8. Nguyễn Thị Hương - MESS, tàu STAR QUEEN, khối FEI
(
  '20230085', 'NGUYỄN THỊ HƯƠNG', 'NGUYEN THI HUONG',
  '2000-09-30', 'F', (SELECT id FROM country WHERE code='VN'),
  '001200008901', '2023-04-05', 'Hà Nội',
  'D3890123', '2023-05-10', '2028-05-09',
  '0923456789',
  '67 Bà Triệu', 'Phường Lê Đại Hành', 'Hai Bà Trưng', 'Hà Nội',
  '9900112233445', 'Sacombank', 'NGUYỄN THỊ HƯƠNG',
  '8901234567', 0,
  'Độc thân', 0, NULL, NULL,
  155, 48, 'XS', '24',
  (SELECT id FROM `rank` WHERE code='MESS'), 'Phục vụ',
  'FEI', 'STAR QUEEN',
  '2023-06-01', '2023-06-03', '12±2',
  1200.00, '2024-06-03', '2024-06-12',
  'ON_VESSEL', NULL
),
-- 9. Bùi Đức Thắng - CAPT, tàu OCEAN STAR, khối SEC
(
  '20190015', 'BÙI ĐỨC THẮNG', 'BUI DUC THANG',
  '1975-01-20', 'M', (SELECT id FROM country WHERE code='VN'),
  '033075009012', '2015-03-25', 'Quảng Ninh',
  'A5901234', '2016-04-10', '2021-04-09',
  '0945678901',
  '12 Hạ Long', 'Phường Bãi Cháy', 'Hạ Long', 'Quảng Ninh',
  '0011223344556', 'Vietcombank', 'BÙI ĐỨC THẮNG',
  '9012345678', 1,
  'Kết hôn', 2, 'Bùi Thị Ngọc, Bùi Đức Huy', '20, 16',
  180, 82, 'XXL', '36',
  (SELECT id FROM `rank` WHERE code='CAPT'), 'Thuyền trưởng',
  'SEC', 'OCEAN STAR',
  '2023-07-20', '2023-07-22', '10±2',
  7000.00, '2024-05-22', '2024-06-01',
  'ON_VESSEL', NULL
),
-- 10. Đinh Văn Khải - ETO, tàu PACIFIC GLORY, khối ASL
(
  '20220055', 'ĐINH VĂN KHẢI', 'DINH VAN KHAI',
  '1988-06-15', 'M', (SELECT id FROM country WHERE code='VN'),
  '048088010123', '2020-09-30', 'Đồng Nai',
  'B8012345', '2021-11-15', '2026-11-14',
  '0956789012',
  '45 Nguyễn Ái Quốc', 'Phường Tân Tiến', 'Biên Hòa', 'Đồng Nai',
  '1122334455678', 'ACB', 'ĐINH VĂN KHẢI',
  '0123456789', 1,
  'Kết hôn', 1, 'Đinh Thị Hà', '6',
  174, 70, 'L', '32',
  (SELECT id FROM `rank` WHERE code='ETO'), 'Sĩ quan điện',
  'ASL', 'PACIFIC GLORY',
  '2023-03-15', '2023-03-17', '9±1',
  3800.00, '2023-12-17', '2023-12-26',
  'AVAILABLE', NULL
);
