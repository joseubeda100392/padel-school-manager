-- Repaso post-incidente: pay_private_lesson_with_bag leía la reserva sin
-- bloquear su fila y confirmaba con un UPDATE sin condición de estado — un
-- doble clic en "Usar bono" (o dos pestañas) podía descontar 2 créditos por
-- una sola clase, porque ambas llamadas pasaban el chequeo "pending" antes
-- de que ninguna confirmara la reserva. Se bloquea la fila de la reserva
-- desde el principio para que la segunda llamada espere y vea ya 'confirmed'.

CREATE OR REPLACE FUNCTION pay_private_lesson_with_bag(
  p_booking_id uuid,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking_status text;
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
  SELECT b.schedule_id, b.status INTO v_schedule_id, v_booking_status
  FROM bookings b
  WHERE b.id = p_booking_id AND b.student_id = p_student_id
  FOR UPDATE;

  IF v_schedule_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Reserva no encontrada');
  END IF;

  IF v_booking_status != 'pending' THEN
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
