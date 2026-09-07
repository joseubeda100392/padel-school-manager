-- Repaso post-incidente: /api/admin/bookings/spot comprobaba el aforo y
-- luego insertaba la reserva en dos pasos separados desde la app — igual
-- que el fallo original del 5/4, pero con ventana más pequeña (dos
-- monitores pulsando "Añadir" casi a la vez para la última plaza podían
-- superar max_students otra vez). Se mueve todo (bloqueo de fila + aforo +
-- inserción + cobro de bolsa + despublicar la falta cubierta) a una única
-- función atómica, igual que ya hace book_capacity_spot para el autoservicio.

CREATE OR REPLACE FUNCTION admin_assign_spot_booking(
  p_schedule_id uuid,
  p_student_id  uuid,
  p_class_date  date,
  p_club_id     uuid,
  p_charge_bag  boolean,  -- true: cobra 1 clase de la bolsa y confirma ya. false: crea 'pending' (particular/externo)
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
    CASE WHEN p_charge_bag THEN 'confirmed' ELSE 'pending' END,
    CASE WHEN p_charge_bag THEN 'bag' ELSE 'admin' END,
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

  -- Si este hueco lo abrió la falta (publicada) de otro alumno del grupo
  -- fijo, márcala como cubierta — si no, "Huecos Libres" la sigue
  -- anunciando aunque ya se haya rellenado.
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
