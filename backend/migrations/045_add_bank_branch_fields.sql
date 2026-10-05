-- Tách chi nhánh ngân hàng thành cột riêng

ALTER TABLE seafarer
  ADD COLUMN IF NOT EXISTS personal_bank_branch  VARCHAR(150) NULL AFTER personal_bank_name,
  ADD COLUMN IF NOT EXISTS salary_bank_branch    VARCHAR(150) NULL AFTER salary_bank_name;
