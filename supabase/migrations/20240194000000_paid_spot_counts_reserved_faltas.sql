-- Pago con tarjeta de un hueco (book_paid_class_spot, lo llama el webhook de
-- Redsys con el dinero ya cobrado).
--
-- Antes: si ese día había una falta sin publicar (el club gestiona esa plaza a
-- mano), la función rechazaba CUALQUIER plaza de la clase, también la de otra
-- falta que sí estaba publicada. Con bolsa (/api/bookings/spot) esa plaza
-- publicada sí se podía coger, y con tarjeta el alumno pagaba y luego se
-- quedaba sin plaza (cobro hecho, devolución a mano). Pasa en 1 de cada 9
-- días con faltas (44 de 411 desde septiembre en R3).
--
-- Ahora: la falta sin publicar solo reserva SU plaza (cuenta como ocupada) y el
-- resto se cuenta igual que antes. Mismo criterio que lib/waitlist.ts
-- (getClassOccupancy), que usa el aviso previo de /api/payments/create-order.
-- CREATE OR REPLACE conserva los permisos (solo service_role).

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
    (SELECT COUNT(*) FROM bookings WHERE schedule_id = p_schedule_id AND class_date = p_class_date AND status = 'confirmed') +
    -- Faltas sin publicar ni cubrir: su plaza la guarda el club.
    (SELECT COUNT(*) FROM schedule_exclusions se
       JOIN group_enrollments ge ON ge.id = se.group_enrollment_id
       WHERE ge.schedule_id = p_schedule_id AND ge.status = 'active'
         AND se.excluded_date = p_class_date AND se.publish_spot = false AND se.spot_taken = false)
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
