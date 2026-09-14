-- Bug real encontrado: varias rutas de reserva puntual (huecos por falta,
-- huecos por capacidad, y la función legacy book_with_bag) creaban la fila
-- en bookings SIN club_id. Un admin normal (no super_admin) filtra sus
-- consultas por club_id — al ser NULL, nunca encuentra esas reservas para
-- cancelarlas/gestionarlas (parece que "no hace nada" al pulsar la X).
-- super_admin no filtra por club y por eso a él sí le funcionaba.
-- 69 reservas activas afectadas en producción a fecha de este commit.

-- 1) Backfill de las reservas ya creadas sin club_id, usando el club_id de
-- su propio horario (siempre fiable, un horario pertenece a un solo club).
UPDATE bookings b
SET club_id = s.club_id
FROM schedules s
WHERE b.schedule_id = s.id
  AND b.club_id IS NULL
  AND s.club_id IS NOT NULL;

-- 2) book_capacity_spot: añadir club_id (derivado del propio horario) al
-- crear o reutilizar la reserva.
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
  v_club_id         uuid;
  v_duration_min    int;
  v_duration_type   text;
  v_current_count   bigint;
  v_existing_id     uuid;
  v_existing_status text;
  v_booking_id      uuid;
  v_debit_result    jsonb;
BEGIN
  SELECT max_students, start_time, end_time, club_id
  INTO v_max_students, v_start_time, v_end_time, v_club_id
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
    UPDATE bookings SET status = 'confirmed', source = 'bag', club_id = v_club_id, updated_at = now() WHERE id = v_existing_id;
    v_booking_id := v_existing_id;
  ELSE
    INSERT INTO bookings (schedule_id, student_id, status, source, class_date, club_id)
    VALUES (p_schedule_id, p_student_id, 'confirmed', 'bag', p_class_date, v_club_id)
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

-- 3) book_paid_class_spot: mismo fix.
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
  v_club_id         uuid;
  v_current_count   bigint;
  v_existing_id     uuid;
  v_existing_status text;
  v_whole_class_taken boolean;
  v_booking_id      uuid;
BEGIN
  SELECT max_students, club_id INTO v_max_students, v_club_id
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
    SET status = 'confirmed', source = 'pay_per_class', club_id = v_club_id,
        notes = CASE WHEN p_whole_class THEN 'clase_entera' ELSE notes END, updated_at = now()
    WHERE id = v_existing_id;
    v_booking_id := v_existing_id;
  ELSE
    INSERT INTO bookings (schedule_id, student_id, status, source, class_date, notes, club_id)
    VALUES (p_schedule_id, p_student_id, 'confirmed', 'pay_per_class', p_class_date, CASE WHEN p_whole_class THEN 'clase_entera' ELSE NULL END, v_club_id)
    RETURNING id INTO v_booking_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id);
END;
$$;

-- 4) book_with_bag: función legacy sin caller activo en la UI actual, pero
-- se corrige igual por si algo la vuelve a invocar (ya está bloqueada a
-- service_role desde la migración de lockdown de RPCs).
CREATE OR REPLACE FUNCTION book_with_bag(
  p_schedule_id uuid,
  p_student_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_students   int;
  v_start_time     timestamptz;
  v_end_time       timestamptz;
  v_club_id        uuid;
  v_duration_min   int;
  v_duration_type  text;
  v_current_count  bigint;
  v_bag_id         uuid;
  v_balance_60     int;
  v_balance_90     int;
  v_new_bal_60     int;
  v_new_bal_90     int;
  v_booking_id     uuid;
BEGIN
  SELECT max_students, start_time, end_time, club_id
  INTO v_max_students, v_start_time, v_end_time, v_club_id
  FROM schedules WHERE id = p_schedule_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Clase no encontrada');
  END IF;

  v_duration_min  := ROUND(EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 60);
  v_duration_type := CASE WHEN v_duration_min >= 80 THEN '90' ELSE '60' END;

  SELECT
    (SELECT COUNT(*) FROM bookings           WHERE schedule_id = p_schedule_id AND status != 'cancelled') +
    (SELECT COUNT(*) FROM group_enrollments  WHERE schedule_id = p_schedule_id AND status = 'active')
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

  SELECT id, balance_60, balance_90
  INTO v_bag_id, v_balance_60, v_balance_90
  FROM class_bag WHERE user_id = p_student_id
  FOR UPDATE;

  IF v_duration_type = '90' THEN
    IF v_bag_id IS NULL OR v_balance_90 <= 0 THEN
      RETURN jsonb_build_object('error', 'No tienes bonos de 90min disponibles en tu bolsa');
    END IF;
    v_new_bal_60 := v_balance_60;
    v_new_bal_90 := v_balance_90 - 1;
  ELSE
    IF v_bag_id IS NULL OR (v_balance_60 <= 0 AND v_balance_90 <= 0) THEN
      RETURN jsonb_build_object('error', 'No tienes clases disponibles en tu bolsa');
    END IF;
    IF v_balance_60 > 0 THEN
      v_new_bal_60 := v_balance_60 - 1;
      v_new_bal_90 := v_balance_90;
    ELSE
      v_new_bal_60 := v_balance_60;
      v_new_bal_90 := v_balance_90 - 1;
    END IF;
  END IF;

  INSERT INTO bookings (schedule_id, student_id, status, source, club_id)
  VALUES (p_schedule_id, p_student_id, 'confirmed', 'bag', v_club_id)
  RETURNING id INTO v_booking_id;

  UPDATE class_bag
  SET balance_60 = v_new_bal_60, balance_90 = v_new_bal_90, updated_at = now()
  WHERE id = v_bag_id;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, booking_id, class_duration)
  VALUES (p_student_id, v_bag_id, -1, 'debit', 'Recuperación de clase', v_booking_id, v_duration_type);

  RETURN jsonb_build_object(
    'ok',          true,
    'booking_id',  v_booking_id,
    'new_balance', v_new_bal_60 + v_new_bal_90
  );
END;
$$;
