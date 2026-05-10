-- RPC book_with_bag: atomic spot check + bag decrement + booking insert
CREATE OR REPLACE FUNCTION book_with_bag(
  p_schedule_id uuid,
  p_student_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_students  int;
  v_current_count bigint;
  v_bag_id        uuid;
  v_balance       int;
  v_booking_id    uuid;
BEGIN
  SELECT max_students INTO v_max_students
  FROM schedules WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Clase no encontrada');
  END IF;

  SELECT
    (SELECT COUNT(*) FROM bookings       WHERE schedule_id = p_schedule_id AND status != 'cancelled') +
    (SELECT COUNT(*) FROM group_enrollments WHERE schedule_id = p_schedule_id AND status = 'active')
  INTO v_current_count;

  IF v_current_count >= v_max_students THEN
    RETURN jsonb_build_object('error', 'No hay plazas disponibles en esta clase');
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE schedule_id = p_schedule_id AND student_id = p_student_id AND status != 'cancelled'
  ) THEN
    RETURN jsonb_build_object('error', 'Ya estás apuntado a esta clase');
  END IF;

  SELECT id, balance INTO v_bag_id, v_balance
  FROM class_bag WHERE user_id = p_student_id
  FOR UPDATE;

  IF v_bag_id IS NULL OR v_balance <= 0 THEN
    RETURN jsonb_build_object('error', 'No tienes clases disponibles en tu bolsa');
  END IF;

  INSERT INTO bookings (schedule_id, student_id, status, source)
  VALUES (p_schedule_id, p_student_id, 'confirmed', 'bag')
  RETURNING id INTO v_booking_id;

  UPDATE class_bag SET balance = balance - 1, updated_at = now() WHERE id = v_bag_id;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, booking_id)
  VALUES (p_student_id, v_bag_id, -1, 'debit', 'Recuperación de clase', v_booking_id);

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'new_balance', v_balance - 1);
END;
$$;
