-- Reservas en espera ("lista de reserva") de una clase en una fecha concreta.
-- Solo AÑADE una tabla y dos funciones: no cambia ninguna tabla ni dato
-- existente. Para deshacerlo:
--   DROP FUNCTION IF EXISTS promote_class_waitlist(uuid, date, uuid[]);
--   DROP FUNCTION IF EXISTS join_class_waitlist(uuid, date, uuid, int);
--   DROP TABLE IF EXISTS class_waitlist;

CREATE TABLE IF NOT EXISTS class_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid REFERENCES clubs(id) ON DELETE CASCADE,
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  class_date  date NOT NULL,
  student_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- waiting: en reserva · promoted: entró en la clase · left: se quitó o ya
  -- estaba dentro · skipped: le tocaba pero no se pudo (sin bolsa, otra clase)
  status      text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'left', 'skipped')),
  booking_id  uuid REFERENCES bookings(id) ON DELETE SET NULL,
  skip_reason text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Un alumno solo puede estar una vez en espera para la misma clase y fecha.
CREATE UNIQUE INDEX IF NOT EXISTS class_waitlist_one_waiting
  ON class_waitlist (schedule_id, class_date, student_id) WHERE status = 'waiting';
CREATE INDEX IF NOT EXISTS class_waitlist_queue
  ON class_waitlist (schedule_id, class_date, status, created_at);
CREATE INDEX IF NOT EXISTS class_waitlist_student
  ON class_waitlist (student_id, status);

-- El servidor usa el service role; desde el navegador cada alumno solo puede
-- leer sus propias filas y nadie puede escribir.
ALTER TABLE class_waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS class_waitlist_select_own ON class_waitlist;
CREATE POLICY class_waitlist_select_own ON class_waitlist
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- Apuntarse en reserva. Bloquea la clase para que dos alumnos a la vez no
-- superen el máximo de plazas en espera.
CREATE OR REPLACE FUNCTION join_class_waitlist(
  p_schedule_id uuid,
  p_class_date  date,
  p_student_id  uuid,
  p_max_waiting int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_waiting int;
  v_id      uuid;
BEGIN
  SELECT club_id INTO v_club_id FROM schedules WHERE id = p_schedule_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Clase no encontrada');
  END IF;

  IF EXISTS (
    SELECT 1 FROM class_waitlist
    WHERE schedule_id = p_schedule_id AND class_date = p_class_date
      AND student_id = p_student_id AND status = 'waiting'
  ) THEN
    RETURN jsonb_build_object('error', 'Ya estás en la reserva de esta clase');
  END IF;

  SELECT COUNT(*) INTO v_waiting FROM class_waitlist
  WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status = 'waiting';

  IF v_waiting >= p_max_waiting THEN
    RETURN jsonb_build_object('error', 'La reserva de esta clase ya está completa');
  END IF;

  INSERT INTO class_waitlist (club_id, schedule_id, class_date, student_id)
  VALUES (v_club_id, p_schedule_id, p_class_date, p_student_id)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'position', v_waiting + 1);
END;
$$;

-- Meter al primero de la reserva en una plaza libre, todo en una transacción:
-- comprueba que sigue habiendo plaza, crea la reserva, descuenta 1 clase de
-- la bolsa y marca la plaza como ocupada. Mismo criterio de plazas que
-- book_capacity_spot y que el alta en un hueco por falta (bookings/spot).
-- p_candidate_ids: filas de class_waitlist en el orden en que les toca,
-- ya filtradas en el servidor (choque de horario, etc.).
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
    AND se.excluded_date = p_class_date AND se.publish_spot = true
  LIMIT 1
  FOR UPDATE OF se;

  -- Sin falta publicada, una falta sin publicar significa que el club la
  -- gestiona a mano: no se toca (igual que book_capacity_spot).
  IF v_exclusion_id IS NULL AND EXISTS (
    SELECT 1 FROM schedule_exclusions se
    JOIN group_enrollments ge ON ge.id = se.group_enrollment_id
    WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
      AND se.excluded_date = p_class_date AND se.publish_spot = false
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
      UPDATE schedule_exclusions SET publish_spot = false WHERE id = v_exclusion_id;
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

-- Solo el servidor (service role) puede llamarlas.
REVOKE EXECUTE ON FUNCTION join_class_waitlist(uuid, date, uuid, int) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION promote_class_waitlist(uuid, date, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION join_class_waitlist(uuid, date, uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION promote_class_waitlist(uuid, date, uuid[]) TO service_role;
