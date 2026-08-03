-- Funciones atómicas para reservar plaza por capacidad libre e inscripción a
-- torneo. Ambas rutas hacían "contar plazas → insertar" en dos pasos
-- separados, sin lock — dos peticiones simultáneas podían pasar el chequeo
-- de aforo a la vez y superar max_students / max_players.

-- Reserva una plaza libre por capacidad, cobrando de la bolsa.
-- Bloquea la fila de schedules para serializar los intentos simultáneos
-- sobre la misma clase.
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
    (SELECT COUNT(*) FROM group_enrollments WHERE schedule_id = p_schedule_id AND status = 'active') +
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

-- Inscribe a un alumno en un torneo, bloqueando la fila del torneo para
-- serializar altas simultáneas y respetar max_players de forma real.
CREATE OR REPLACE FUNCTION register_for_tournament(
  p_tournament_id uuid,
  p_student_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status      text;
  v_max_players int;
  v_count       bigint;
BEGIN
  SELECT status, max_players INTO v_status, v_max_players
  FROM tournaments WHERE id = p_tournament_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Torneo no encontrado');
  END IF;

  IF v_status != 'open' THEN
    RETURN jsonb_build_object('error', 'Las inscripciones están cerradas');
  END IF;

  IF EXISTS (
    SELECT 1 FROM tournament_registrations
    WHERE tournament_id = p_tournament_id AND student_id = p_student_id
  ) THEN
    RETURN jsonb_build_object('error', 'Ya estás inscrito');
  END IF;

  SELECT COUNT(*) INTO v_count FROM tournament_registrations WHERE tournament_id = p_tournament_id;

  IF v_count >= v_max_players THEN
    RETURN jsonb_build_object('error', 'El torneo está completo');
  END IF;

  INSERT INTO tournament_registrations (tournament_id, student_id) VALUES (p_tournament_id, p_student_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;
