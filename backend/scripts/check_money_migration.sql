-- Regression check on a disposable PostgreSQL snapshot at migration 049.
-- Run with psql -X -v ON_ERROR_STOP=1 -f scripts/check_money_migration.sql.
-- All changes roll back. The snapshot should include old custom items and a bill
-- whose grouped adjustments exceed 9,999,999,999.99 (the deployment failure).
\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE money_bill_before AS
SELECT b.id AS bill_id, COALESCE(SUM(i.amount_usd), 0) AS total
FROM contract_bill b LEFT JOIN contract_bill_item i ON i.bill_id = b.id GROUP BY b.id;
CREATE TEMP TABLE money_contract_before AS
SELECT contract_id, SUM(receivable_usd) AS receivable, SUM(payable_usd) AS payable
FROM contract_item GROUP BY contract_id;

\ir ../migrations/postgres/049a_money_item_precision.sql
\ir ../migrations/postgres/050_fixed_money_items.sql
\ir ../migrations/postgres/051_seafarer_payout.sql
\ir ../migrations/postgres/052_payout_money_precision.sql

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM money_bill_before b
    FULL JOIN (SELECT bill_id, SUM(amount_usd) AS total FROM contract_bill_item GROUP BY bill_id) a USING (bill_id)
    WHERE b.total IS DISTINCT FROM a.total
  ) THEN RAISE EXCEPTION 'Migration changed bill totals'; END IF;
  IF EXISTS (
    SELECT 1 FROM money_contract_before b
    FULL JOIN (SELECT contract_id, SUM(receivable_usd) AS receivable, SUM(payable_usd) AS payable
      FROM contract_item GROUP BY contract_id) a USING (contract_id)
    WHERE b.receivable IS DISTINCT FROM a.receivable OR b.payable IS DISTINCT FROM a.payable
  ) THEN RAISE EXCEPTION 'Migration changed contract totals'; END IF;
  IF EXISTS (SELECT 1 FROM contract_bill b LEFT JOIN contract_bill_item i ON i.bill_id = b.id
    GROUP BY b.id HAVING COUNT(i.id) <> 14) THEN RAISE EXCEPTION 'Bill must have 14 items'; END IF;
  IF EXISTS (SELECT 1 FROM seafarer_contract c LEFT JOIN contract_item i ON i.contract_id = c.id
    GROUP BY c.id HAVING COUNT(i.id) <> 14) THEN RAISE EXCEPTION 'Contract must have 14 items'; END IF;
  IF EXISTS (SELECT 1 FROM contract_bill_item WHERE amount_usd < 0)
    THEN RAISE EXCEPTION 'Negative bill item after migration'; END IF;
END $$;
-- Check the new payout columns accept the largest migrated bill, too.
INSERT INTO seafarer_payout (bill_id, status, paid_date, bill_total_usd)
SELECT bill_id, 'PAID', CURRENT_DATE, total FROM money_bill_before ORDER BY total DESC LIMIT 1;
INSERT INTO seafarer_payout_item (payout_id, item_code, kind, default_usd, amount_usd)
SELECT p.id, i.item_code, i.kind, i.default_usd, i.amount_usd
FROM seafarer_payout p JOIN contract_bill_item i ON i.bill_id = p.bill_id;
ROLLBACK;
\echo Money migration regression passed; all changes rolled back.
