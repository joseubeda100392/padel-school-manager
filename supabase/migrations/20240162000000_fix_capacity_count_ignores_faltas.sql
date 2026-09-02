-- book_capacity_spot y book_paid_class_spot contaban TODOS los
-- group_enrollments activos del horario como presentes en la fecha, sin
-- descontar a quien tiene registrada una falta (schedule_exclusions) justo
-- ese día. Resultado: un grupo fijo de 3 con 1 falta + 1 sustituto ya
-- reservado se contaba como "4 de 4" (3 fijos + 1 sustituto, sin restar al
-- ausente) y rechazaba a un alumno que en la práctica sí cabía, con "La
-- clase ya está completa".
--
-- Fix: el conteo de fijos excluye a quien tiene excluded_date = la fecha
-- de la reserva para ese group_enrollment.

CREATE OR REPLACE FUNCTION book_capacity_spot(
  p_schedule_id uuid,
  p_student_id  uuid,
  p_class_date  date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_students    int;
  v_start_time      timestamptz;
  v_end_time        timestamptz;
  v_duration_min    int;
  v_duration_type   text;
  v_current_count   bigint;
  v_existing_id     uuid;
  v_existing_status text;
  v_booking_id      uuid;
  v_debit_result    jsonb;
BEGIN
  SELECT max_students, start_time, end_time
  INTO v_max_students, v_start_time, v_end_time
  FROM schedules WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Clase no encontrada');
  END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM bookings
  WHERE schedule_id = p_schedule_id AND student_id = p_student_id AND class_date = p_class_date;

  IF v_existing_id IS NOT NULL AND v_existing_status = 'confirmed' THEN
    RETURN jsonb_build_object('error', 'Ya tienes esta plaza reservada');
  END IF;

  SELECT
    (SELECT COUNT(*) FROM group_enrollments ge
       WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM schedule_exclusions se
           WHERE se.group_enrollment_id = ge.id AND se.excluded_date = p_class_date
         )
    ) +
    (SELECT COUNT(*) FROM bookings WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status = 'confirmed')
  INTO v_current_count;

  IF v_current_count >= v_max_students THEN
    RETURN jsonb_build_object('error', 'La clase ya está completa');
  END IF;

  v_duration_min := ROUND(EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 60);
  v_duration_type := CASE WHEN v_duration_min >= 80 THEN '90' ELSE '60' END;

  IF v_existing_id IS NOT NULL THEN
    UPDATE bookings SET status = 'confirmed', source = 'bag', updated_at = now() WHERE id = v_existing_id;
    v_booking_id := v_existing_id;
  ELSE
    INSERT INTO bookings (schedule_id, student_id, status, source, class_date)
    VALUES (p_schedule_id, p_student_id, 'confirmed', 'bag', p_class_date)
    RETURNING id INTO v_booking_id;
  END IF;

  v_debit_result := debit_class_bag_for_booking(
    p_student_id, v_duration_type, 'Plaza libre del ' || p_class_date::text, v_booking_id
  );

  IF v_debit_result ? 'error' THEN
    -- Sin saldo: revertir la reserva que acabamos de crear/reactivar
    IF v_existing_id IS NOT NULL THEN
      UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = v_booking_id;
    ELSE
      DELETE FROM bookings WHERE id = v_booking_id;
    END IF;
    RETURN v_debit_result;
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'new_balance', v_debit_result->'new_balance');
END;
$$;

CREATE OR REPLACE FUNCTION book_paid_class_spot(
  p_schedule_id  uuid,
  p_student_id   uuid,
  p_class_date   date,
  p_whole_class  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_students    int;
  v_current_count   bigint;
  v_existing_id     uuid;
  v_existing_status text;
  v_whole_class_taken boolean;
  v_booking_id      uuid;
BEGIN
  SELECT max_students INTO v_max_students
  FROM schedules WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Clase no encontrada');
  END IF;

  SELECT id, status INTO v_existing_id, v_existing_status
  FROM bookings
  WHERE schedule_id = p_schedule_id AND student_id = p_student_id AND class_date = p_class_date;

  IF v_existing_id IS NOT NULL AND v_existing_status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'booking_id', v_existing_id, 'already_existed', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM bookings
    WHERE schedule_id = p_schedule_id AND class_date = p_class_date
      AND status = 'confirmed' AND notes = 'clase_entera'
  ) INTO v_whole_class_taken;

  IF v_whole_class_taken THEN
    RETURN jsonb_build_object('error', 'Esta clase ya está pagada entera por otro alumno para esta fecha');
  END IF;

  SELECT
    (SELECT COUNT(*) FROM group_enrollments ge
       WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
         AND NOT EXISTS (
           SELECT 1 FROM schedule_exclusions se
           WHERE se.group_enrollment_id = ge.id AND se.excluded_date = p_class_date
         )
    ) +
    (SELECT COUNT(*) FROM bookings WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status = 'confirmed')
  INTO v_current_count;

  IF p_whole_class THEN
    IF v_current_count > 0 THEN
      RETURN jsonb_build_object('error', 'Ya hay alumnos apuntados a esta clase, no se puede pagar como clase entera');
    END IF;
  ELSE
    IF v_current_count >= v_max_students THEN
      RETURN jsonb_build_object('error', 'La clase ya está completa');
    END IF;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE bookings
    SET status = 'confirmed', source = 'pay_per_class', notes = CASE WHEN p_whole_class THEN 'clase_entera' ELSE notes END, updated_at = now()
    WHERE id = v_existing_id;
    v_booking_id := v_existing_id;
  ELSE
    INSERT INTO bookings (schedule_id, student_id, status, source, class_date, notes)
    VALUES (p_schedule_id, p_student_id, 'confirmed', 'pay_per_class', p_class_date, CASE WHEN p_whole_class THEN 'clase_entera' ELSE NULL END)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;
