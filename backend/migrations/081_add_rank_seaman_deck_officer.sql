-- Migration 081: Thêm rank Sỹ quan boong và Thủy thủ
-- Dùng để map với kết quả AI quét sổ thuyền viên

INSERT INTO `rank` (code, name_vi, name_en, department, rank_level) VALUES
('DO',     'Sỹ quan boong', 'Deck Officer', 'DECK', 1),
('SEAMAN', 'Thủy thủ',      'Seaman',       'DECK', 2)
ON DUPLICATE KEY UPDATE name_vi = VALUES(name_vi), name_en = VALUES(name_en);
