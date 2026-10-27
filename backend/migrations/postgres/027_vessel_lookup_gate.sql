-- Trần chung cho Lấy thông tin thông minh: cả hệ thống chỉ được gọi nguồn ngoài 1 lần mỗi N giây (mặc định 120),
-- bất kể IMO hay người dùng. Một dòng duy nhất; mốc last_call_at được giành bằng UPDATE có điều kiện (nguyên tử trong Postgres),
-- nên nhiều yêu cầu cùng lúc hay nhiều bản backend vẫn chỉ một yêu cầu gọi được, và khởi động lại không làm mất mốc.
CREATE TABLE "vessel_lookup_gate" (
  "id" SMALLINT NOT NULL PRIMARY KEY CHECK ("id" = 1),
  "last_call_at" TIMESTAMP WITHOUT TIME ZONE NOT NULL
);
INSERT INTO "vessel_lookup_gate" ("id", "last_call_at") VALUES (1, TIMESTAMP '1970-01-01 00:00:00');
