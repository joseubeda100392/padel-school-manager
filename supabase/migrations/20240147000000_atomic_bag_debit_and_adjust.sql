-- Funciones atómicas para descuento de bolsa (reservas) y ajuste manual (admin).
-- Reemplazan el patrón read-modify-write de bookings/spot, bookings/capacity-spot
-- y admin/students/bag-adjust, que permitía que dos reservas simultáneas leyeran
-- el mismo saldo y gastaran el mismo crédito dos veces.

-- Descuenta 1 clase de la bolsa para una reserva de plaza suelta.
-- Para 60min: usa balance_60 primero, balance_90 como respaldo.
-- Para 90min: solo balance_90.
CREATE OR REPLACE FUNCTION debit_class_bag_for_booking(
  p_user_id       uuid,
  p_duration_type text,   -- '60' | '90'
  p_reason        text,
  p_booking_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bag_id      uuid;
  v_balance_60  int;
  v_balance_90  int;
  v_use_90      boolean;
  v_new_bal_60  int;
  v_new_bal_90  int;
BEGIN
  SELECT id, balance_60, balance_90
  INTO v_bag_id, v_balance_60, v_balance_90
  FROM class_bag WHERE user_id = p_user_id
  FOR UPDATE;

  IF p_duration_type = '90' THEN
    IF v_bag_id IS NULL OR v_balance_90 <= 0 THEN
      RETURN jsonb_build_object('error', 'No tienes bonos de 90min disponibles en tu bolsa');
    END IF;
    v_use_90 := true;
  ELSE
    IF v_bag_id IS NULL OR (v_balance_60 <= 0 AND v_balance_90 <= 0) THEN
      RETURN jsonb_build_object('error', 'No tienes clases disponibles en tu bolsa');
    END IF;
    v_use_90 := v_balance_60 <= 0;
  END IF;

  v_new_bal_60 := CASE WHEN v_use_90 THEN v_balance_60 ELSE v_balance_60 - 1 END;
  v_new_bal_90 := CASE WHEN v_use_90 THEN v_balance_90 - 1 ELSE v_balance_90 END;

  UPDATE class_bag
  SET balance_60 = v_new_bal_60, balance_90 = v_new_bal_90, updated_at = now()
  WHERE id = v_bag_id;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, booking_id, class_duration)
  VALUES (p_user_id, v_bag_id, -1, 'debit', p_reason, p_booking_id, p_duration_type);

  RETURN jsonb_build_object('ok', true, 'bag_id', v_bag_id, 'new_balance', v_new_bal_60 + v_new_bal_90);
END;
$$;

-- Ajuste manual de admin sobre balance_60/balance_90, con suelo en 0.
-- El delta insertado en bag_transactions es el que realmente se aplicó
-- (ya clampado), para que el ledger no diverja del saldo.
CREATE OR REPLACE FUNCTION adjust_class_bag(
  p_user_id  uuid,
  p_delta_60 int,
  p_delta_90 int,
  p_reason   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bag_id      uuid;
  v_balance_60  int;
  v_balance_90  int;
  v_new_bal_60  int;
  v_new_bal_90  int;
  v_applied_60  int;
  v_applied_90  int;
BEGIN
  SELECT id, balance_60, balance_90
  INTO v_bag_id, v_balance_60, v_balance_90
  FROM class_bag WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_bag_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Bolsa no encontrada');
  END IF;

  v_new_bal_60 := GREATEST(0, v_balance_60 + p_delta_60);
  v_new_bal_90 := GREATEST(0, v_balance_90 + p_delta_90);
  v_applied_60 := v_new_bal_60 - v_balance_60;
  v_applied_90 := v_new_bal_90 - v_balance_90;

  UPDATE class_bag
  SET balance_60 = v_new_bal_60, balance_90 = v_new_bal_90, updated_at = now()
  WHERE id = v_bag_id;

  IF v_applied_60 != 0 THEN
    INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, class_duration)
    VALUES (p_user_id, v_bag_id, v_applied_60, (CASE WHEN v_applied_60 > 0 THEN 'credit' ELSE 'debit' END)::bag_transaction_type, p_reason, '60');
  END IF;

  IF v_applied_90 != 0 THEN
    INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, class_duration)
    VALUES (p_user_id, v_bag_id, v_applied_90, (CASE WHEN v_applied_90 > 0 THEN 'credit' ELSE 'debit' END)::bag_transaction_type, p_reason, '90');
  END IF;

  RETURN jsonb_build_object('ok', true, 'bag_id', v_bag_id, 'new_balance_60', v_new_bal_60, 'new_balance_90', v_new_bal_90);
END;
$$;
