-- Split class_bag balance into balance_60 and balance_90
ALTER TABLE class_bag
  ADD COLUMN IF NOT EXISTS balance_60 int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_90 int NOT NULL DEFAULT 0;

-- Migrate existing balance → balance_60 (existing credits assumed to be 60min)
UPDATE class_bag SET balance_60 = balance WHERE balance > 0 AND balance_60 = 0;

-- Track which duration type was used in each transaction (for correct refunds)
ALTER TABLE bag_transactions
  ADD COLUMN IF NOT EXISTS class_duration text CHECK (class_duration IN ('60', '90'));

-- Updated book_with_bag: respects 60/90 split
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
  SELECT max_students, start_time, end_time
  INTO v_max_students, v_start_time, v_end_time
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
    -- Bono 60min NO puede usarse para clases de 90min
    IF v_bag_id IS NULL OR v_balance_90 <= 0 THEN
      RETURN jsonb_build_object('error', 'No tienes bonos de 90min disponibles en tu bolsa');
    END IF;
    v_new_bal_60 := v_balance_60;
    v_new_bal_90 := v_balance_90 - 1;
  ELSE
    -- Para 60min: usar balance_60 primero, balance_90 como respaldo
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

  INSERT INTO bookings (schedule_id, student_id, status, source)
  VALUES (p_schedule_id, p_student_id, 'confirmed', 'bag')
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
