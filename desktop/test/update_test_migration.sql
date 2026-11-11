-- Migration thử của bước 0.7: chỉ có trong bản 0.0.2 thử (stage.js thêm vào khi MCAH_TEST_MIGRATION=1).
CREATE TABLE IF NOT EXISTS desktop_update_test (id SERIAL PRIMARY KEY, note TEXT NOT NULL);
INSERT INTO desktop_update_test (note) VALUES ('đã chạy migration của bản 0.0.2');
