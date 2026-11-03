-- Mã mới nối từ mã cha (CH2601-01/HĐ/T1) dài hơn mã cũ.
ALTER TABLE "opportunity" ALTER COLUMN "code" TYPE varchar(32);
ALTER TABLE "seafarer_voyage" ALTER COLUMN "code" TYPE varchar(32);
ALTER TABLE "seafarer_contract" ALTER COLUMN "contract_number" TYPE varchar(32);
ALTER TABLE "contract_bill" ALTER COLUMN "code" TYPE varchar(32);
