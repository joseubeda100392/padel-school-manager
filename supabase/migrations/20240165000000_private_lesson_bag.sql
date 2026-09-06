-- Bono de clase particular (Pieza 3 del módulo enable_private_lessons):
-- 8 saldos nuevos — separados del balance_60/90 normal — porque un bono
-- barato (monitor normal) no debe poder gastarse en una sesión con el
-- monitor premium, ni el de alumno interno usarse a precio de externo.
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_60 int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_90 int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_60_external int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_90_external int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_60_premium int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_90_premium int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_60_premium_external int NOT NULL DEFAULT 0;
ALTER TABLE class_bag ADD COLUMN IF NOT EXISTS balance_private_90_premium_external int NOT NULL DEFAULT 0;

-- Acreditar un bono de particular recién comprado. p_bucket es el sufijo de
-- duración+combinación ya resuelto por la app (ej. '60', '90_premium') —
-- se valida contra una lista fija, nunca SQL dinámico con texto libre.
CREATE OR REPLACE FUNCTION credit_private_bag(
  p_user_id  uuid,
  p_club_id  uuid,
  p_delta    int,
  p_bucket   text,  -- '60' | '90' | '60_external' | '90_external' | '60_premium' | '90_premium' | '60_premium_external' | '90_premium_external'
  p_reason   text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bag_id      uuid;
  v_new_balance int;
BEGIN
  INSERT INTO class_bag (user_id, club_id)
  VALUES (p_user_id, p_club_id)
  ON CONFLICT (user_id) DO NOTHING;

  IF p_bucket = '60' THEN
    UPDATE class_bag SET balance_private_60 = balance_private_60 + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_60 INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '90' THEN
    UPDATE class_bag SET balance_private_90 = balance_private_90 + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_90 INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '60_external' THEN
    UPDATE class_bag SET balance_private_60_external = balance_private_60_external + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_60_external INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '90_external' THEN
    UPDATE class_bag SET balance_private_90_external = balance_private_90_external + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_90_external INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '60_premium' THEN
    UPDATE class_bag SET balance_private_60_premium = balance_private_60_premium + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_60_premium INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '90_premium' THEN
    UPDATE class_bag SET balance_private_90_premium = balance_private_90_premium + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_90_premium INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '60_premium_external' THEN
    UPDATE class_bag SET balance_private_60_premium_external = balance_private_60_premium_external + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_60_premium_external INTO v_bag_id, v_new_balance;
  ELSIF p_bucket = '90_premium_external' THEN
    UPDATE class_bag SET balance_private_90_premium_external = balance_private_90_premium_external + p_delta, updated_at = now()
    WHERE user_id = p_user_id RETURNING id, balance_private_90_premium_external INTO v_bag_id, v_new_balance;
  ELSE
    RETURN jsonb_build_object('error', 'Bucket de bono particular inválido');
  END IF;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, class_duration)
  VALUES (p_user_id, v_bag_id, p_delta, 'credit', p_reason, left(p_bucket, 2));

  RETURN jsonb_build_object('ok', true, 'bag_id', v_bag_id, 'new_balance', v_new_balance);
END;
$$;

-- Pagar una clase particular ya asignada (reserva en 'pending') con crédito
-- de bono en vez de tarjeta. Todo en una transacción: bloquea la fila de
-- bolsa, comprueba saldo, descuenta, y confirma LA MISMA reserva (nunca crea
-- una nueva) — evita el mismo problema de doble gasto que ya se cerró para
-- las faltas de grupo fijo.
CREATE OR REPLACE FUNCTION pay_private_lesson_with_bag(
  p_booking_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_schedule_id   uuid;
  v_start_time    timestamptz;
  v_end_time      timestamptz;
  v_is_private    boolean;
  v_coach_id      uuid;
  v_duration_min  int;
  v_dur           text;
  v_is_external   boolean;
  v_is_premium    boolean;
  v_bucket        text;
  v_bag_id        uuid;
  v_balance       int;
BEGIN
  SELECT b.schedule_id INTO v_schedule_id
  FROM bookings b
  WHERE b.id = p_booking_id AND b.student_id = p_student_id AND b.status = 'pending';

  IF v_schedule_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Reserva no encontrada o ya pagada');
  END IF;

  SELECT start_time, end_time, is_private, coach_id
  INTO v_start_time, v_end_time, v_is_private, v_coach_id
  FROM schedules WHERE id = v_schedule_id;

  IF NOT v_is_private THEN
    RETURN jsonb_build_object('error', 'Esta reserva no es una clase particular');
  END IF;

  v_duration_min := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 60;
  v_dur := CASE WHEN v_duration_min >= 80 THEN '90' ELSE '60' END;

  SELECT is_external INTO v_is_external FROM users WHERE id = p_student_id;
  SELECT is_premium_private_coach INTO v_is_premium FROM users WHERE id = v_coach_id;

  v_bucket := v_dur
    || (CASE WHEN v_is_premium THEN '_premium' ELSE '' END)
    || (CASE WHEN v_is_external THEN '_external' ELSE '' END);

  SELECT id INTO v_bag_id FROM class_bag WHERE user_id = p_student_id FOR UPDATE;
  IF v_bag_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No tienes bono de clase particular');
  END IF;

  IF v_bucket = '60' THEN
    SELECT balance_private_60 INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_60 = balance_private_60 - 1, updated_at = now() WHERE id = v_bag_id;
  ELSIF v_bucket = '90' THEN
    SELECT balance_private_90 INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_90 = balance_private_90 - 1, updated_at = now() WHERE id = v_bag_id;
  ELSIF v_bucket = '60_external' THEN
    SELECT balance_private_60_external INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_60_external = balance_private_60_external - 1, updated_at = now() WHERE id = v_bag_id;
  ELSIF v_bucket = '90_external' THEN
    SELECT balance_private_90_external INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_90_external = balance_private_90_external - 1, updated_at = now() WHERE id = v_bag_id;
  ELSIF v_bucket = '60_premium' THEN
    SELECT balance_private_60_premium INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_60_premium = balance_private_60_premium - 1, updated_at = now() WHERE id = v_bag_id;
  ELSIF v_bucket = '90_premium' THEN
    SELECT balance_private_90_premium INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_90_premium = balance_private_90_premium - 1, updated_at = now() WHERE id = v_bag_id;
  ELSIF v_bucket = '60_premium_external' THEN
    SELECT balance_private_60_premium_external INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_60_premium_external = balance_private_60_premium_external - 1, updated_at = now() WHERE id = v_bag_id;
  ELSE -- '90_premium_external'
    SELECT balance_private_90_premium_external INTO v_balance FROM class_bag WHERE id = v_bag_id;
    IF v_balance < 1 THEN RETURN jsonb_build_object('error', 'No tienes bono de clase particular disponible'); END IF;
    UPDATE class_bag SET balance_private_90_premium_external = balance_private_90_premium_external - 1, updated_at = now() WHERE id = v_bag_id;
  END IF;

  UPDATE bookings SET status = 'confirmed', source = 'bag', updated_at = now() WHERE id = p_booking_id;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, class_duration, booking_id)
  VALUES (p_student_id, v_bag_id, -1, 'debit', 'Clase particular', v_dur, p_booking_id);

  RETURN jsonb_build_object('ok', true, 'new_balance', v_balance - 1);
END;
$$;
