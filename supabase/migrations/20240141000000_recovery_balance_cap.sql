-- Add recovery balance tracking to class_bag
ALTER TABLE class_bag
  ADD COLUMN IF NOT EXISTS recovery_balance_60 integer NOT NULL DEFAULT 0 CHECK (recovery_balance_60 >= 0),
  ADD COLUMN IF NOT EXISTS recovery_balance_90 integer NOT NULL DEFAULT 0 CHECK (recovery_balance_90 >= 0);

-- Trigger: when total balance decreases, shrink recovery balance proportionally
-- This fires automatically when book_with_bag or any UPDATE decrements the balance
CREATE OR REPLACE FUNCTION sync_recovery_balance_on_debit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance_60 < OLD.balance_60 THEN
    NEW.recovery_balance_60 = GREATEST(0, NEW.recovery_balance_60 - (OLD.balance_60 - NEW.balance_60));
  END IF;
  IF NEW.balance_90 < OLD.balance_90 THEN
    NEW.recovery_balance_90 = GREATEST(0, NEW.recovery_balance_90 - (OLD.balance_90 - NEW.balance_90));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_recovery_on_balance_update ON class_bag;
CREATE TRIGGER sync_recovery_on_balance_update
  BEFORE UPDATE OF balance_60, balance_90 ON class_bag
  FOR EACH ROW
  EXECUTE FUNCTION sync_recovery_balance_on_debit();
