-- Ngày chạy gần nhất của từng job ngày (backend/src/jobs.js runDaily): app máy tính chạy bù job lỡ giờ khi máy tắt
-- qua đêm, mỗi job tối đa một lần mỗi ngày.
CREATE TABLE IF NOT EXISTS job_run (
  name TEXT PRIMARY KEY,
  last_run_on DATE NOT NULL
);
