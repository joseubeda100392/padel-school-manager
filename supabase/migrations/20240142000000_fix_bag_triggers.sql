-- Los triggers trg_bag_credit_on_exclusion y trg_bag_debit_on_exclusion_delete
-- escribían en la columna `balance` (obsoleta desde migration 20240128).
-- El crédito/débito lo maneja correctamente el código de aplicación en
-- schedule-exclusions/route.ts y cancel-session/route.ts usando balance_60/balance_90.

DROP TRIGGER IF EXISTS trg_bag_credit_on_exclusion ON schedule_exclusions;
DROP FUNCTION IF EXISTS fn_bag_credit_on_exclusion();

DROP TRIGGER IF EXISTS trg_bag_debit_on_exclusion_delete ON schedule_exclusions;
DROP FUNCTION IF EXISTS fn_bag_debit_on_exclusion_delete();

-- Añadir CHECK constraints para evitar balances negativos
-- (recovery_balance_60/90 ya tienen CHECK desde migration 20240141)
ALTER TABLE class_bag
  ADD CONSTRAINT IF NOT EXISTS chk_balance_60_non_negative CHECK (balance_60 >= 0),
  ADD CONSTRAINT IF NOT EXISTS chk_balance_90_non_negative CHECK (balance_90 >= 0);
