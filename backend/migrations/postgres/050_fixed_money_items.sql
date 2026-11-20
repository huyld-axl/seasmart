-- 14 khoản tiền cố định cho hợp đồng, yêu cầu thanh toán và trả lương (docs/mcah-ke-hoach-tra-luong.md phần A).
-- Bỏ khoản tự đặt tên ở hợp đồng, bỏ dòng điều chỉnh ở bill; mọi hợp đồng và bill có đủ 14 khoản; không khoản bill nào âm.
-- Dữ liệu cũ (D9): khoản tự đặt tên cộng vào Khác (hằng tháng / một lần) theo nhóm, tên cũ ghi vào ghi chú;
-- dòng điều chỉnh của bill cộng vào Khác (hằng tháng); âm thì trừ phần thiếu vào các khoản khác theo thứ tự. Tổng bill giữ nguyên.

CREATE TEMP TABLE fixed_item (code varchar(30) PRIMARY KEY, kind varchar(10) NOT NULL, name varchar(100) NOT NULL, ord SMALLINT NOT NULL);
INSERT INTO fixed_item (code, kind, name, ord) VALUES
  ('BASIC_WAGE', 'MONTHLY', 'Lương cơ bản', 0),
  ('FIXED_OVERTIME', 'MONTHLY', 'Làm thêm cố định', 1),
  ('LEAVE_PAY', 'MONTHLY', 'Lương phép', 2),
  ('ALLOWANCE', 'MONTHLY', 'Phụ cấp', 3),
  ('BONUS', 'MONTHLY', 'Thưởng', 4),
  ('SERVICE_FEE', 'MONTHLY', 'Phí dịch vụ', 5),
  ('OTHER_MONTHLY', 'MONTHLY', 'Khác (hằng tháng)', 6),
  ('FLIGHT_OUT', 'ONE_TIME', 'Vé máy bay đi', 7),
  ('FLIGHT_BACK', 'ONE_TIME', 'Vé máy bay về', 8),
  ('VISA_FEE', 'ONE_TIME', 'Phí visa', 9),
  ('MEDICAL', 'ONE_TIME', 'Khám sức khoẻ', 10),
  ('TRAINING', 'ONE_TIME', 'Huấn luyện/chứng chỉ', 11),
  ('COMPLETION_BONUS', 'ONE_TIME', 'Thưởng hoàn thành hợp đồng', 12),
  ('OTHER_ONE_TIME', 'ONE_TIME', 'Khác (một lần)', 13);

-- ---------- Hợp đồng ----------
-- Tên cũ vào ghi chú: "Khác (hằng tháng) gồm: Phụ cấp tàu dầu 100/80".
WITH merged AS (
  SELECT i.contract_id,
    string_agg(
      CASE i.kind WHEN 'MONTHLY' THEN 'Khác (hằng tháng)' ELSE 'Khác (một lần)' END || ' gồm: ' || i.custom_name || ' '
        || COALESCE(i.receivable_usd::text, '—') || '/' || COALESCE(i.payable_usd::text, '—'),
      E'\n' ORDER BY i.kind, i.sort_order, i.id) AS lines
  FROM contract_item i WHERE i.item_code IS NULL GROUP BY i.contract_id
)
UPDATE seafarer_contract c SET notes = CASE WHEN c.notes IS NULL OR c.notes = '' THEN m.lines ELSE c.notes || E'\n' || m.lines END
FROM merged m WHERE m.contract_id = c.id;

-- Cộng khoản tự đặt tên theo nhóm (trống + trống = trống).
CREATE TEMP TABLE custom_sum AS
SELECT contract_id, CASE kind WHEN 'MONTHLY' THEN 'OTHER_MONTHLY' ELSE 'OTHER_ONE_TIME' END AS code,
  SUM(receivable_usd) AS receivable_usd, SUM(payable_usd) AS payable_usd
FROM contract_item WHERE item_code IS NULL GROUP BY 1, 2;
DELETE FROM contract_item WHERE item_code IS NULL;

-- Đủ 14 khoản cho mọi hợp đồng, đúng thứ tự.
INSERT INTO contract_item (contract_id, kind, item_code, receivable_usd, payable_usd, sort_order)
SELECT c.id, f.kind, f.code, s.receivable_usd, s.payable_usd, f.ord
FROM seafarer_contract c CROSS JOIN fixed_item f
LEFT JOIN custom_sum s ON s.contract_id = c.id AND s.code = f.code
WHERE NOT EXISTS (SELECT 1 FROM contract_item i WHERE i.contract_id = c.id AND i.item_code = f.code);
UPDATE contract_item i SET sort_order = f.ord, kind = f.kind FROM fixed_item f WHERE f.code = i.item_code;

ALTER TABLE contract_item DROP CONSTRAINT contract_item_name_check;
ALTER TABLE contract_item DROP COLUMN custom_name;
ALTER TABLE contract_item ALTER COLUMN item_code SET NOT NULL;
ALTER TABLE contract_item ADD CONSTRAINT contract_item_code_check CHECK (item_code IN (
  'BASIC_WAGE', 'FIXED_OVERTIME', 'LEAVE_PAY', 'ALLOWANCE', 'BONUS', 'SERVICE_FEE', 'OTHER_MONTHLY',
  'FLIGHT_OUT', 'FLIGHT_BACK', 'VISA_FEE', 'MEDICAL', 'TRAINING', 'COMPLETION_BONUS', 'OTHER_ONE_TIME'));

-- ---------- Yêu cầu thanh toán ----------
-- Dòng không mã (khoản tự đặt tên chép từ hợp đồng, dòng điều chỉnh): tên và số vào ghi chú bill.
WITH merged AS (
  SELECT bill_id, string_agg(name || ' ' || amount_usd::text, '; ' ORDER BY sort_order, id) AS line
  FROM contract_bill_item WHERE item_code IS NULL GROUP BY bill_id
)
UPDATE contract_bill b SET note = CASE WHEN b.note IS NULL OR b.note = '' THEN '' ELSE b.note || E'\n' END || 'Gộp vào Khác: ' || m.line
FROM merged m WHERE m.bill_id = b.id;

CREATE TEMP TABLE bill_other AS
SELECT bill_id, CASE kind WHEN 'ONE_TIME' THEN 'OTHER_ONE_TIME' ELSE 'OTHER_MONTHLY' END AS code,
  SUM(amount_usd) AS amount_usd, COALESCE(SUM(default_usd), 0) AS default_usd
FROM contract_bill_item WHERE item_code IS NULL GROUP BY 1, 2;
DELETE FROM contract_bill_item WHERE item_code IS NULL;

ALTER TABLE contract_bill_item DROP CONSTRAINT contract_bill_item_kind_check;
ALTER TABLE contract_bill_item DROP CONSTRAINT contract_bill_item_default_check;

-- Đủ 14 khoản cho mọi bill (kể cả đã xoá mềm); khoản thiếu là 0.
INSERT INTO contract_bill_item (bill_id, item_code, kind, name, default_usd, amount_usd, sort_order)
SELECT b.id, f.code, f.kind, f.name, COALESCE(o.default_usd, 0), COALESCE(o.amount_usd, 0), f.ord
FROM contract_bill b CROSS JOIN fixed_item f
LEFT JOIN bill_other o ON o.bill_id = b.id AND o.code = f.code
WHERE NOT EXISTS (SELECT 1 FROM contract_bill_item i WHERE i.bill_id = b.id AND i.item_code = f.code);
UPDATE contract_bill_item i SET sort_order = f.ord, kind = f.kind FROM fixed_item f WHERE f.code = i.item_code;

-- Khác âm (điều chỉnh trừ nhiều hơn khoản Khác): đưa Khác về 0, trừ phần thiếu vào các khoản còn lại theo thứ tự.
DO $$
DECLARE
  neg RECORD;
  line RECORD;
  deficit NUMERIC;
  take NUMERIC;
BEGIN
  FOR neg IN
    SELECT i.id, i.bill_id, -i.amount_usd AS deficit, b.code FROM contract_bill_item i JOIN contract_bill b ON b.id = i.bill_id
    WHERE i.amount_usd < 0 ORDER BY i.bill_id, i.sort_order
  LOOP
    deficit := neg.deficit;
    UPDATE contract_bill_item SET amount_usd = 0 WHERE id = neg.id;
    FOR line IN SELECT id, amount_usd FROM contract_bill_item WHERE bill_id = neg.bill_id AND amount_usd > 0 ORDER BY sort_order LOOP
      EXIT WHEN deficit <= 0;
      take := LEAST(line.amount_usd, deficit);
      UPDATE contract_bill_item SET amount_usd = amount_usd - take WHERE id = line.id;
      deficit := deficit - take;
    END LOOP;
    RAISE NOTICE 'Bill % có điều chỉnh âm, đã trừ vào các khoản khác%', neg.code,
      CASE WHEN deficit > 0 THEN ' (còn thiếu ' || deficit || ', tổng bill tăng)' ELSE '' END;
  END LOOP;
END $$;

ALTER TABLE contract_bill_item ALTER COLUMN item_code SET NOT NULL;
ALTER TABLE contract_bill_item ALTER COLUMN default_usd SET NOT NULL;
ALTER TABLE contract_bill_item ADD CONSTRAINT contract_bill_item_kind_check CHECK (kind IN ('MONTHLY', 'ONE_TIME'));
ALTER TABLE contract_bill_item ADD CONSTRAINT contract_bill_item_amount_check CHECK (amount_usd >= 0);
ALTER TABLE contract_bill_item ADD CONSTRAINT contract_bill_item_code_check CHECK (item_code IN (
  'BASIC_WAGE', 'FIXED_OVERTIME', 'LEAVE_PAY', 'ALLOWANCE', 'BONUS', 'SERVICE_FEE', 'OTHER_MONTHLY',
  'FLIGHT_OUT', 'FLIGHT_BACK', 'VISA_FEE', 'MEDICAL', 'TRAINING', 'COMPLETION_BONUS', 'OTHER_ONE_TIME'));
CREATE UNIQUE INDEX contract_bill_item_code_uniq ON contract_bill_item (bill_id, item_code);
DROP TABLE fixed_item, custom_sum, bill_other;
