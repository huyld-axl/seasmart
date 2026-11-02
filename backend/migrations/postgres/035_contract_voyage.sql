-- Hợp đồng gắn chuyến mới. Hợp đồng cũ vẫn giữ voyage_position_id.
ALTER TABLE "seafarer_contract" ADD COLUMN "seafarer_voyage_id" INTEGER REFERENCES "seafarer_voyage" ("id");
ALTER TABLE "seafarer_contract" ALTER COLUMN "voyage_position_id" DROP NOT NULL;
CREATE UNIQUE INDEX "seafarer_contract_voyage_uniq" ON "seafarer_contract" ("seafarer_voyage_id")
  WHERE "deleted_at" IS NULL AND "seafarer_voyage_id" IS NOT NULL;
ALTER TABLE "seafarer_contract" ADD CONSTRAINT "seafarer_contract_link_check"
  CHECK ("seafarer_voyage_id" IS NOT NULL OR "voyage_position_id" IS NOT NULL);

-- Log hợp đồng: thêm Đưa về Nháp, Kết thúc, Áp thay đổi bill, Xoá theo chuyến.
ALTER TABLE "contract_approval_log" DROP CONSTRAINT "contract_approval_log_action_check";
ALTER TABLE "contract_approval_log" ADD CONSTRAINT "contract_approval_log_action_check"
  CHECK ("action" IN ('CREATE', 'SUBMIT', 'WITHDRAW', 'APPROVE', 'REJECT', 'REVERT', 'END', 'APPLY_BILLS', 'DELETE'));
ALTER TABLE "contract_approval_log" ADD COLUMN "payload" JSONB;

-- Bill: kỳ duy nhất chỉ tính bill chưa xoá; log thêm cắt kỳ và xoá.
ALTER TABLE "contract_bill" DROP CONSTRAINT "contract_bill_contract_id_side_seq_key";
CREATE UNIQUE INDEX "contract_bill_seq_uniq" ON "contract_bill" ("contract_id", "side", "seq") WHERE "deleted_at" IS NULL;
ALTER TABLE "contract_bill_log" DROP CONSTRAINT "contract_bill_log_action_check";
ALTER TABLE "contract_bill_log" ADD CONSTRAINT "contract_bill_log_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'SEND', 'UNSEND', 'COLLECT', 'UNCOLLECT', 'CUT', 'DELETE'));
ALTER TABLE "contract_bill_log" ADD COLUMN "payload" JSONB;

-- Nối hợp đồng cũ đã chuyển sang chuyến mới ở giai đoạn 1.
UPDATE "seafarer_contract" c SET "seafarer_voyage_id" = sv."id"
  FROM "seafarer_voyage" sv WHERE sv."legacy_contract_id" = c."id" AND sv."deleted_at" IS NULL;

-- Quyền mới contract.end: cấp cho vai trò đang có contract.approve.
INSERT INTO "role_permission" ("role_id", "permission")
SELECT "role_id", 'contract.end' FROM "role_permission" WHERE "permission" = 'contract.approve'
ON CONFLICT DO NOTHING;
