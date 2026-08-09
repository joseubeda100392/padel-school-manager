-- El pago de clase suelta por Redsys (single_class, incluye "clase entera")
-- hacía "contar plazas → insertar reserva" en dos pasos separados dentro del
-- webhook, sin lock — igual que el bug ya corregido para la reserva por
-- bolsa (book_capacity_spot). Además "clase entera" no impedía que otros
-- alumnos pagaran también su plaza individual para la misma fecha, dando
-- lugar a cobro duplicado. Esta función resuelve ambos problemas: bloquea
-- la fila de schedules para serializar intentos simultáneos, y usa
-- bookings.notes = 'clase_entera' como marcador de "fecha ya cubierta".
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
    (SELECT COUNT(*) FROM group_enrollments WHERE schedule_id = p_schedule_id AND status = 'active') +
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
