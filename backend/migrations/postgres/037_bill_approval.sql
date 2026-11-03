-- Luồng duyệt bill: Chưa duyệt (OPEN) → Đã duyệt (APPROVED) → Đã gửi → Đã thu. Chỉ gửi bill đã duyệt.
ALTER TABLE "contract_bill" ADD COLUMN "approved_at" TIMESTAMP WITHOUT TIME ZONE;
ALTER TABLE "contract_bill" ADD COLUMN "approved_by" INTEGER REFERENCES "user" ("id");

-- Bill đã gửi / đã thu trước đây coi như đã duyệt; bill chưa gửi giữ OPEN, phải duyệt lại.
UPDATE "contract_bill" SET "approved_at" = "sent_at", "approved_by" = "sent_by" WHERE "status" IN ('SENT', 'PAID');

ALTER TABLE "contract_bill" DROP CONSTRAINT "contract_bill_status_check";
ALTER TABLE "contract_bill" ADD CONSTRAINT "contract_bill_status_check" CHECK ("status" IN ('OPEN', 'APPROVED', 'SENT', 'PAID'));
ALTER TABLE "contract_bill" DROP CONSTRAINT "contract_bill_sent_check";
ALTER TABLE "contract_bill" ADD CONSTRAINT "contract_bill_sent_check" CHECK ("status" IN ('OPEN', 'APPROVED') OR "sent_at" IS NOT NULL);
ALTER TABLE "contract_bill" ADD CONSTRAINT "contract_bill_approved_check" CHECK ("status" = 'OPEN' OR "approved_at" IS NOT NULL);

ALTER TABLE "contract_bill_log" DROP CONSTRAINT "contract_bill_log_action_check";
ALTER TABLE "contract_bill_log" ADD CONSTRAINT "contract_bill_log_action_check"
  CHECK ("action" IN ('CREATE', 'UPDATE', 'APPROVE', 'UNAPPROVE', 'SEND', 'UNSEND', 'COLLECT', 'UNCOLLECT', 'CUT', 'DELETE'));

-- Quyền mới bill.approve: cấp cho vai trò đang có contract.approve.
INSERT INTO "role_permission" ("role_id", "permission")
SELECT "role_id", 'bill.approve' FROM "role_permission" WHERE "permission" = 'contract.approve'
ON CONFLICT DO NOTHING;
