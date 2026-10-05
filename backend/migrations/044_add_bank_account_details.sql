-- Thêm thông tin chi tiết cho từng tài khoản ngân hàng của thuyền viên

ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS personal_bank_name            VARCHAR(150) NULL AFTER personal_bank_account_number,
  ADD COLUMN IF NOT EXISTS personal_bank_account_holder  VARCHAR(150) NULL AFTER personal_bank_name,
  ADD COLUMN IF NOT EXISTS salary_bank_name              VARCHAR(150) NULL AFTER salary_bank_account_number,
  ADD COLUMN IF NOT EXISTS salary_bank_account_holder    VARCHAR(150) NULL AFTER salary_bank_name;
