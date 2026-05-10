-- +1 bolsa automático al registrar una falta en grupo fijo
CREATE OR REPLACE FUNCTION fn_bag_credit_on_exclusion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_student_id uuid;
  v_bag_id     uuid;
BEGIN
  SELECT student_id INTO v_student_id
  FROM group_enrollments WHERE id = NEW.group_enrollment_id;

  IF v_student_id IS NULL THEN RETURN NEW; END IF;

  -- Crea la fila en class_bag si no existe
  INSERT INTO class_bag (user_id, balance)
  VALUES (v_student_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Incrementa y obtiene el id
  UPDATE class_bag
  SET balance = balance + 1, updated_at = now()
  WHERE user_id = v_student_id
  RETURNING id INTO v_bag_id;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason)
  VALUES (v_student_id, v_bag_id, 1, 'credit', 'Falta en clase — crédito de recuperación');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bag_credit_on_exclusion ON schedule_exclusions;
CREATE TRIGGER trg_bag_credit_on_exclusion
AFTER INSERT ON schedule_exclusions
FOR EACH ROW EXECUTE FUNCTION fn_bag_credit_on_exclusion();

-- -1 bolsa si se elimina la exclusión (deshacer el crédito)
CREATE OR REPLACE FUNCTION fn_bag_debit_on_exclusion_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_student_id uuid;
  v_bag_id     uuid;
BEGIN
  SELECT student_id INTO v_student_id
  FROM group_enrollments WHERE id = OLD.group_enrollment_id;

  IF v_student_id IS NULL THEN RETURN OLD; END IF;

  SELECT id INTO v_bag_id FROM class_bag WHERE user_id = v_student_id;
  IF v_bag_id IS NULL THEN RETURN OLD; END IF;

  UPDATE class_bag
  SET balance = GREATEST(0, balance - 1), updated_at = now()
  WHERE id = v_bag_id;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason)
  VALUES (v_student_id, v_bag_id, -1, 'debit', 'Exclusión eliminada — crédito retirado');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bag_debit_on_exclusion_delete ON schedule_exclusions;
CREATE TRIGGER trg_bag_debit_on_exclusion_delete
AFTER DELETE ON schedule_exclusions
FOR EACH ROW EXECUTE FUNCTION fn_bag_debit_on_exclusion_delete();
