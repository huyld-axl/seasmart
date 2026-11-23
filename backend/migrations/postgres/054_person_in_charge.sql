-- Người phụ trách (docs/mcah-ke-hoach-nguoi-phu-trach.md): thuyền viên → hợp đồng → bill, kế thừa lúc tạo.
-- Cơ hội giữ cột owner_user_id sẵn có, không nối chuỗi.
ALTER TABLE "seafarer" ADD COLUMN "pic_user_id" INTEGER REFERENCES "user" ("id");
ALTER TABLE "seafarer_contract" ADD COLUMN "pic_user_id" INTEGER REFERENCES "user" ("id");
ALTER TABLE "contract_bill" ADD COLUMN "pic_user_id" INTEGER REFERENCES "user" ("id");
CREATE INDEX "seafarer_pic_idx" ON "seafarer" ("pic_user_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "seafarer_contract_pic_idx" ON "seafarer_contract" ("pic_user_id") WHERE "deleted_at" IS NULL;
CREATE INDEX "contract_bill_pic_idx" ON "contract_bill" ("pic_user_id") WHERE "deleted_at" IS NULL;

-- Bù dữ liệu cũ theo thứ tự cha → con (cả bản ghi đã xoá mềm). Người tạo đã bị xoá thì để trống.
UPDATE "seafarer" s SET "pic_user_id" = s."created_by"
  WHERE s."created_by" IS NOT NULL AND EXISTS (SELECT 1 FROM "user" u WHERE u."id" = s."created_by");
UPDATE "seafarer_contract" c SET "pic_user_id" = COALESCE(
  (SELECT s."pic_user_id" FROM "seafarer" s WHERE s."id" = c."seafarer_id"),
  (SELECT u."id" FROM "user" u WHERE u."id" = c."created_by"));
UPDATE "contract_bill" b SET "pic_user_id" = c."pic_user_id" FROM "seafarer_contract" c WHERE c."id" = b."contract_id";

-- Log đổi người phụ trách.
ALTER TABLE "contract_approval_log" DROP CONSTRAINT "contract_approval_log_action_check";
ALTER TABLE "contract_approval_log" ADD CONSTRAINT "contract_approval_log_action_check"
  CHECK ("action" IN ('CREATE', 'SUBMIT', 'WITHDRAW', 'APPROVE', 'REJECT', 'REVERT', 'END', 'APPLY_BILLS', 'DELETE', 'ASSIGN'));
ALTER TABLE "contract_bill_log" DROP CONSTRAINT "contract_bill_log_action_check";
ALTER TABLE "contract_bill_log" ADD CONSTRAINT "contract_bill_log_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'APPROVE', 'UNAPPROVE', 'SEND', 'UNSEND', 'COLLECT', 'UNCOLLECT', 'CUT', 'DELETE', 'ASSIGN'));

DO $$
DECLARE s INTEGER; c INTEGER; b INTEGER;
BEGIN
  SELECT COUNT(*) INTO s FROM "seafarer" WHERE "pic_user_id" IS NULL AND "deleted_at" IS NULL;
  SELECT COUNT(*) INTO c FROM "seafarer_contract" WHERE "pic_user_id" IS NULL AND "deleted_at" IS NULL;
  SELECT COUNT(*) INTO b FROM "contract_bill" WHERE "pic_user_id" IS NULL AND "deleted_at" IS NULL;
  RAISE NOTICE 'Chưa giao người phụ trách: % thuyền viên, % hợp đồng, % bill', s, c, b;
END $$;
