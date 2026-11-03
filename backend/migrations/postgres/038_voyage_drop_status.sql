-- Chuyến không còn trạng thái: "đang trên tàu" là chưa có ngày rời (leave_date IS NULL).
DROP INDEX "seafarer_voyage_onboard_uniq";
ALTER TABLE "seafarer_voyage"
  DROP CONSTRAINT "seafarer_voyage_status_check",
  DROP CONSTRAINT "seafarer_voyage_left_check",
  DROP COLUMN "status";
ALTER TABLE "seafarer_voyage"
  ADD CONSTRAINT "seafarer_voyage_left_check" CHECK (("leave_date" IS NULL) = ("leave_port_id" IS NULL));
CREATE UNIQUE INDEX "seafarer_voyage_onboard_uniq" ON "seafarer_voyage" ("seafarer_id") WHERE "leave_date" IS NULL AND "deleted_at" IS NULL;
