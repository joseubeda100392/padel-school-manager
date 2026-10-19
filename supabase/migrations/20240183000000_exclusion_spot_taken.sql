-- Faltas: separar "plaza ya cogida" de "plaza que gestiona el club a mano".
--
-- Hasta ahora las dos cosas se guardaban igual (publish_spot = false):
--   · el admin registra una falta sin publicarla para meter él a alguien, y
--   · un alumno coge la plaza de una falta publicada (Huecos, pago con
--     tarjeta, reserva en espera o el admin).
-- Las funciones de reserva tratan cualquier falta no publicada como "la
-- gestiona el club" y no dejan coger ninguna plaza de esa clase ese día. Así,
-- en cuanto alguien cogía una plaza de una falta, cualquier otra plaza que se
-- liberase después en esa clase y fecha (cancelación, baja del grupo…) se
-- quedaba sin poder cogerse en Huecos ni pasar a la reserva en espera.
--
-- Ahora la plaza cogida se marca con spot_taken = true y solo bloquea una
-- falta no publicada y no cubierta. Las faltas cogidas antes de esta
-- migración siguen como estaban (bloqueando); afecta solo a fechas pasadas o
-- muy próximas.
--
-- Compatible con el código anterior: mientras no se despliegue el nuevo, las
-- plazas cogidas siguen con spot_taken = false y todo funciona como hasta hoy.

ALTER TABLE schedule_exclusions ADD COLUMN IF NOT EXISTS spot_taken boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION book_capacity_spot(
  p_schedule_id uuid,
  p_student_id  uuid,
  p_class_date  date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      AND se.excluded_date = p_class_date AND se.publish_spot = false AND se.spot_taken = false
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

CREATE OR REPLACE FUNCTION book_paid_class_spot(
  p_schedule_id  uuid,
  p_student_id   uuid,
  p_class_date   date,
  p_whole_class  boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
      AND se.excluded_date = p_class_date AND se.publish_spot = false AND se.spot_taken = false
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
SET search_path = public
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
    -- El alumno que mete el admin ocupa la plaza de una falta: primero una
    -- publicada y, si no hay, la que el club estaba gestionando a mano. Así
    -- esa falta queda cubierta y no bloquea otras plazas que se liberen.
    UPDATE schedule_exclusions se
    SET publish_spot = false, spot_taken = true
    WHERE se.id = (
      SELECT se2.id FROM schedule_exclusions se2
      JOIN group_enrollments ge2 ON ge2.id = se2.group_enrollment_id
      WHERE ge2.schedule_id = p_schedule_id AND ge2.status = 'active'
        AND se2.excluded_date = p_class_date AND se2.spot_taken = false
      ORDER BY se2.publish_spot DESC
      LIMIT 1
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'booking_id', v_booking_id, 'new_balance', v_new_balance);
END;
$$;

CREATE OR REPLACE FUNCTION promote_class_waitlist(
  p_schedule_id   uuid,
  p_class_date    date,
  p_candidate_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_students    int;
  v_start_time      timestamptz;
  v_end_time        timestamptz;
  v_club_id         uuid;
  v_is_private      boolean;
  v_count           bigint;
  v_exclusion_id    uuid;
  v_duration_type   text;
  v_candidate       uuid;
  v_wl              class_waitlist%ROWTYPE;
  v_existing_id     uuid;
  v_existing_status text;
  v_booking_id      uuid;
  v_debit           jsonb;
  v_skipped         jsonb := '[]'::jsonb;
BEGIN
  SELECT max_students, start_time, end_time, club_id, COALESCE(is_private, false)
  INTO v_max_students, v_start_time, v_end_time, v_club_id, v_is_private
  FROM schedules WHERE id = p_schedule_id
  FOR UPDATE;

  IF NOT FOUND OR v_is_private THEN
    RETURN jsonb_build_object('promoted', false, 'reason', 'no_class', 'skipped', v_skipped);
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
    (SELECT COUNT(*) FROM bookings
       WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status != 'cancelled')
  INTO v_count;

  IF v_count >= v_max_students THEN
    RETURN jsonb_build_object('promoted', false, 'reason', 'full', 'skipped', v_skipped);
  END IF;

  -- Plaza de un fijo que falta y está publicada: se ocupa esa.
  SELECT se.id INTO v_exclusion_id
  FROM schedule_exclusions se
  JOIN group_enrollments ge ON ge.id = se.group_enrollment_id
  WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
    AND se.excluded_date = p_class_date AND se.publish_spot = true AND se.spot_taken = false
  LIMIT 1
  FOR UPDATE OF se;

  -- Sin falta publicada, una falta sin publicar significa que el club la
  -- gestiona a mano: no se toca (igual que book_capacity_spot).
  IF v_exclusion_id IS NULL AND EXISTS (
    SELECT 1 FROM schedule_exclusions se
    JOIN group_enrollments ge ON ge.id = se.group_enrollment_id
    WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
      AND se.excluded_date = p_class_date AND se.publish_spot = false AND se.spot_taken = false
  ) THEN
    RETURN jsonb_build_object('promoted', false, 'reason', 'managed_by_club', 'skipped', v_skipped);
  END IF;

  v_duration_type := CASE WHEN ROUND(EXTRACT(EPOCH FROM (v_end_time - v_start_time)) / 60) >= 80 THEN '90' ELSE '60' END;

  FOREACH v_candidate IN ARRAY p_candidate_ids LOOP
    SELECT * INTO v_wl FROM class_waitlist
    WHERE id = v_candidate AND schedule_id = p_schedule_id AND class_date = p_class_date AND status = 'waiting'
    FOR UPDATE;
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Ya está en la clase ese día (fijo o con reserva): sale de la espera.
    IF EXISTS (
      SELECT 1 FROM bookings
      WHERE schedule_id = p_schedule_id AND student_id = v_wl.student_id
        AND class_date = p_class_date AND status != 'cancelled'
    ) OR EXISTS (
      SELECT 1 FROM group_enrollments ge
      WHERE ge.schedule_id = p_schedule_id AND ge.student_id = v_wl.student_id AND ge.status = 'active'
        AND (ge.start_date IS NULL OR ge.start_date <= p_class_date)
        AND (ge.end_date IS NULL OR ge.end_date >= p_class_date)
    ) THEN
      UPDATE class_waitlist SET status = 'left', updated_at = now() WHERE id = v_wl.id;
      CONTINUE;
    END IF;

    SELECT id, status INTO v_existing_id, v_existing_status
    FROM bookings
    WHERE schedule_id = p_schedule_id AND student_id = v_wl.student_id AND class_date = p_class_date;

    IF v_existing_id IS NOT NULL THEN
      UPDATE bookings SET status = 'confirmed', source = 'bag', club_id = v_club_id, updated_at = now()
      WHERE id = v_existing_id;
      v_booking_id := v_existing_id;
    ELSE
      INSERT INTO bookings (schedule_id, student_id, status, source, class_date, club_id)
      VALUES (p_schedule_id, v_wl.student_id, 'confirmed', 'bag', p_class_date, v_club_id)
      RETURNING id INTO v_booking_id;
    END IF;

    v_debit := debit_class_bag_for_booking(
      v_wl.student_id, v_duration_type, 'Entrada desde reserva del ' || p_class_date::text, v_booking_id
    );

    IF v_debit ? 'error' THEN
      IF v_existing_id IS NOT NULL THEN
        UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = v_booking_id;
      ELSE
        DELETE FROM bookings WHERE id = v_booking_id;
      END IF;
      UPDATE class_waitlist SET status = 'skipped', skip_reason = v_debit->>'error', updated_at = now()
      WHERE id = v_wl.id;
      v_skipped := v_skipped || jsonb_build_array(jsonb_build_object(
        'waitlist_id', v_wl.id, 'student_id', v_wl.student_id, 'reason', v_debit->>'error'
      ));
      CONTINUE;
    END IF;

    IF v_exclusion_id IS NOT NULL THEN
      UPDATE schedule_exclusions SET publish_spot = false, spot_taken = true WHERE id = v_exclusion_id;
    END IF;

    UPDATE class_waitlist SET status = 'promoted', booking_id = v_booking_id, updated_at = now()
    WHERE id = v_wl.id;

    RETURN jsonb_build_object(
      'promoted', true,
      'waitlist_id', v_wl.id,
      'student_id', v_wl.student_id,
      'booking_id', v_booking_id,
      'new_balance', v_debit->'new_balance',
      'skipped', v_skipped
    );
  END LOOP;

  RETURN jsonb_build_object('promoted', false, 'reason', 'no_candidates', 'skipped', v_skipped);
END;
$$;
