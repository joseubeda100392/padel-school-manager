-- Medias horas de recuperación: cuando una clase de 1 h 30 de la bolsa se usa
-- para recuperar en una clase de 1 h, sobran 30 minutos. Se guardan en
-- class_bag.half_hours y, al llegar a 3 (= 1 h 30), se suma una clase de
-- 1 h 30 a la bolsa y el contador vuelve a 0. Así no se pierde ningún minuto.
--
-- Solo cambia lo que pasa al gastar una clase de 1 h 30 en una de 1 h: las dos
-- funciones que lo hacen (debit_class_bag_for_booking, que usan todas las
-- reservas de huecos, y book_with_bag) son las mismas que antes con el aviso
-- al contador. Anular una recuperación sigue devolviendo una clase de 1 h, que
-- con la media hora guardada suma exactamente la 1 h 30 gastada.
--
-- Solo añade cosas: una columna con valor 0 para todos y una función nueva.

ALTER TABLE class_bag
  ADD COLUMN IF NOT EXISTS half_hours integer NOT NULL DEFAULT 0
  CHECK (half_hours >= 0 AND half_hours < 3);

CREATE OR REPLACE FUNCTION bank_bag_half_hour(p_bag_id uuid, p_user_id uuid, p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_half int;
BEGIN
  UPDATE class_bag SET half_hours = half_hours + 1 WHERE id = p_bag_id
  RETURNING half_hours INTO v_half;

  IF v_half >= 3 THEN
    UPDATE class_bag
    SET half_hours = 0, balance_90 = balance_90 + 1, updated_at = now()
    WHERE id = p_bag_id;

    INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, booking_id, class_duration)
    VALUES (p_user_id, p_bag_id, 1, 'credit', '3 medias horas de recuperaciones en clases de 1 h', p_booking_id, '90');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION bank_bag_half_hour(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bank_bag_half_hour(uuid, uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION debit_class_bag_for_booking(
  p_user_id       uuid,
  p_duration_type text,   -- '60' | '90'
  p_reason        text,
  p_booking_id    uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- Clase de 1 h 30 gastada en una de 1 h: guardar la media hora que sobra.
  IF v_use_90 AND p_duration_type = '60' THEN
    PERFORM bank_bag_half_hour(v_bag_id, p_user_id, p_booking_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'bag_id', v_bag_id,
    'new_balance', (SELECT balance_60 + balance_90 FROM class_bag WHERE id = v_bag_id));
END;
$$;

CREATE OR REPLACE FUNCTION book_with_bag(
  p_schedule_id uuid,
  p_student_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_duration_type = '60' AND v_new_bal_90 < v_balance_90 THEN
    PERFORM bank_bag_half_hour(v_bag_id, p_student_id, v_booking_id);
  END IF;

  RETURN jsonb_build_object(
    'ok',          true,
    'booking_id',  v_booking_id,
    'new_balance', (SELECT balance_60 + balance_90 FROM class_bag WHERE id = v_bag_id)
  );
END;
$$;
