-- Dữ liệu synthetic cho thiết kế UI và demo MCAH (docs/mcah-ui-ux-design-plan.md, giai đoạn 0).
-- Thay cho migrations/011_seed_seafarer.sql khi chụp ảnh hay demo: 011 lấy từ file V-ISEA, tên có thể là thật.
-- Mọi tên, số CCCD, hộ chiếu, SĐT ở đây là tự đặt: CCCD bắt đầu 0000, SĐT 0900 000 xxx.
-- Phủ ca biên: tên dài hai dòng, thiếu SĐT, thiếu hộ chiếu, nhiều trạng thái.
-- Chạy: mysql --default-character-set=utf8mb4 marineport < backend/scripts/seed_demo_synthetic.sql

SET NAMES utf8mb4;

DELETE FROM seafarer WHERE seafarer_code LIKE 'DEMO-%';

INSERT INTO seafarer (
  seafarer_code, full_name, full_name_en, date_of_birth, gender, nationality_id,
  national_id, passport_number, passport_expiry, phone_primary,
  current_rank_id, rank_name_vi, status
) VALUES
('DEMO-0001', 'Trần Minh Khôi', 'TRAN MINH KHOI', '1986-03-12', 'M', (SELECT id FROM country WHERE code = 'VN'),
 '000086000001', 'D0000001', '2029-05-20', '0900000001',
 (SELECT id FROM `rank` WHERE code = 'CO'), 'Đại phó', 'AVAILABLE'),
('DEMO-0002', 'Nguyễn Thị Hồng Nhung Phương Anh', 'NGUYEN THI HONG NHUNG PHUONG ANH', '1995-11-02', 'F', (SELECT id FROM country WHERE code = 'VN'),
 '000095000002', 'D0000002', '2027-01-15', '0900000002',
 (SELECT id FROM `rank` WHERE code = 'AB'), 'Thủy thủ trực ca', 'ON_VESSEL'),
('DEMO-0003', 'Lê Văn Đức', 'LE VAN DUC', '1979-07-30', 'M', (SELECT id FROM country WHERE code = 'VN'),
 '000079000003', NULL, NULL, NULL,
 (SELECT id FROM `rank` WHERE code = 'CE'), 'Máy trưởng', 'ON_LEAVE'),
('DEMO-0004', 'Phạm Quốc Bảo', 'PHAM QUOC BAO', '1991-01-19', 'M', (SELECT id FROM country WHERE code = 'VN'),
 '000091000004', 'D0000004', '2026-12-01', '0900000004',
 (SELECT id FROM `rank` WHERE code = 'COOK'), 'Bếp trưởng', 'AVAILABLE'),
('DEMO-0005', 'Hoàng Thị Mai', 'HOANG THI MAI', '1998-09-08', 'F', (SELECT id FROM country WHERE code = 'VN'),
 '000098000005', 'D0000005', '2030-03-03', '0900000005',
 (SELECT id FROM `rank` WHERE code = '3O'), 'Phó ba', 'TRAINING'),
('DEMO-0006', 'Võ Thanh Sơn', 'VO THANH SON', '1983-04-25', 'M', (SELECT id FROM country WHERE code = 'VN'),
 '000083000006', 'D0000006', '2028-08-18', '0900000006',
 (SELECT id FROM `rank` WHERE code = '2E'), 'Máy hai', 'INACTIVE');
