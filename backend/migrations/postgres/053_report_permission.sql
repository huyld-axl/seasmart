-- Báo cáo tháng (docs/mcah-ke-hoach-bao-cao.md): cấp cho vai trò đang xem được bảng trả lương, phạm vi theo trả lương.
INSERT INTO "role_permission" ("role_id", "permission")
SELECT "role_id", v.p FROM "role_permission", (VALUES ('report.view'), ('report.export')) AS v(p) WHERE "permission" = 'payout.view'
ON CONFLICT DO NOTHING;
UPDATE "role" SET "scopes" = "scopes" || jsonb_build_object('report', "scopes" -> 'payout') WHERE "scopes" ? 'payout';
