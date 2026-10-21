-- Logo công ty đối tác (chủ tàu): tệp lưu trên máy chủ, bảng chỉ giữ đường dẫn và loại ảnh.
ALTER TABLE "ship_owner"
  ADD COLUMN "logo_path" varchar(500),
  ADD COLUMN "logo_mime" varchar(50);
