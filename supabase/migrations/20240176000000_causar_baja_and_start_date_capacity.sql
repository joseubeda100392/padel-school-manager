-- "Causar baja para el mes que viene" con sustituto opcional. El sustituto
-- se da de alta YA en la clase, pero con start_date = día 1 del mes que
-- viene — para que no cuente en el aforo de este mes mientras el alumno
-- saliente todavía está activo. Por eso primero se cierra el hueco real que
-- ya existía: ninguna función de aforo miraba start_date, solo si el
-- group_enrollment estaba 'active' — así que un alta con fecha futura ya
-- contaba de más desde el minuto uno. Se corrige aquí en las 3 funciones
-- atómicas de reserva.

ALTER TABLE group_enrollments
  ADD COLUMN IF NOT EXISTS replaces_enrollment_id uuid REFERENCES group_enrollments(id) ON DELETE SET NULL;

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

  IF EXISTS (
    SELECT 1 FROM schedule_exclusions se
    JOIN group_enrollments ge ON ge.id = se.group_enrollment_id
    WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
      AND se.excluded_date = p_class_date AND se.publish_spot = false
  ) THEN
    RETURN jsonb_build_object('error', 'Esta plaza la está gestionando el club directamente');
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
         AND (ge.start_date IS NULL OR ge.start_date <= p_class_date)
           AND (ge.end_date IS NULL OR ge.end_date >= p_class_date)
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

  IF EXISTS (
    SELECT 1 FROM schedule_exclusions se
    JOIN group_enrollments ge ON ge.id = se.group_enrollment_id
    WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
      AND se.excluded_date = p_class_date AND se.publish_spot = false
  ) THEN
    RETURN jsonb_build_object('error', 'Esta plaza la está gestionando el club directamente');
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
         AND (ge.start_date IS NULL OR ge.start_date <= p_class_date)
           AND (ge.end_date IS NULL OR ge.end_date >= p_class_date)
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

CREATE OR REPLACE FUNCTION admin_assign_spot_booking(
  p_schedule_id uuid,
  p_student_id  uuid,
  p_class_date  date,
  p_club_id     uuid,
  p_charge_bag  boolean,
  p_reason      text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_students  int;
  v_start_time    timestamptz;
  v_end_time      timestamptz;
  v_is_private    boolean;
  v_current_count bigint;
  v_booking_id    uuid;
  v_duration_type text;
  v_debit_result  jsonb;
  v_new_balance   jsonb;
BEGIN
  SELECT max_students, start_time, end_time, is_private
  INTO v_max_students, v_start_time, v_end_time, v_is_private
  FROM schedules WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Clase no encontrada');
  END IF;

  IF EXISTS (
    SELECT 1 FROM bookings
    WHERE schedule_id = p_schedule_id AND student_id = p_student_id
      AND class_date = p_class_date AND status != 'cancelled'
  ) THEN
    RETURN jsonb_build_object('error', 'Este alumno ya tiene una reserva para esta fecha');
  END IF;

  IF v_is_private THEN
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status != 'cancelled'
    ) THEN
      RETURN jsonb_build_object('error', 'Esta clase particular ya tiene un alumno asignado ese día');
    END IF;
  ELSE
    SELECT
      (SELECT COUNT(*) FROM group_enrollments ge
         WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
           AND (ge.start_date IS NULL OR ge.start_date <= p_class_date)
           AND (ge.end_date IS NULL OR ge.end_date >= p_class_date)
           AND NOT EXISTS (
             SELECT 1 FROM schedule_exclusions se
             WHERE se.group_enrollment_id = ge.id AND se.excluded_date = p_class_date
           )
      ) +
      (SELECT COUNT(*) FROM bookings WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status != 'cancelled')
    INTO v_current_count;

    IF v_current_count >= v_max_students THEN
      RETURN jsonb_build_object('error', 'Esta clase ya está completa ese día');
    END IF;
  END IF;

  INSERT INTO bookings (schedule_id, student_id, status, source, class_date, club_id)
  VALUES (
    p_schedule_id, p_student_id,
    (CASE WHEN p_charge_bag THEN 'confirmed' ELSE 'pending' END)::booking_status,
    (CASE WHEN p_charge_bag THEN 'bag' ELSE 'admin' END)::booking_source,
    p_class_date, p_club_id
  )
  RETURNING id INTO v_booking_id;

  IF p_charge_bag THEN
    v_duration_type := CASE WHEN ROUND(EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 60) >= 80 THEN '90' ELSE '60' END;
    v_debit_result := debit_class_bag_for_booking(p_student_id, v_duration_type, p_reason, v_booking_id);
    IF v_debit_result ? 'error' THEN
      DELETE FROM bookings WHERE id = v_booking_id;
      RETURN v_debit_result;
    END IF;
    v_new_balance := v_debit_result->'new_balance';
  END IF;

  IF NOT v_is_private THEN
    UPDATE schedule_exclusions se
    SET publish_spot = false
    WHERE se.id = (
      SELECT se2.id FROM schedule_exclusions se2
      JOIN group_enrollments ge2 ON ge2.id = se2.group_enrollment_id
      WHERE ge2.schedule_id = p_schedule_id AND ge2.status = 'active'
        AND se2.excluded_date = p_class_date AND se2.publish_spot = true
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'new_balance', v_new_balance);
END;
$$;
