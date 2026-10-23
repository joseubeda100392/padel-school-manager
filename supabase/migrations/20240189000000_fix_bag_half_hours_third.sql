-- Arreglo de 20240188: al guardar la 3ª media hora, el contador pasaba un
-- momento por 3 antes de volver a 0, y la regla de la columna (de 0 a 2) lo
-- rechazaba: la reserva entera fallaba. Ahora se sube el contador y se cambia
-- por una clase de 1 h 30 en una sola actualización.
--
-- Solo reemplaza esta función; nada más cambia.

CREATE OR REPLACE FUNCTION bank_bag_half_hour(p_bag_id uuid, p_user_id uuid, p_booking_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_converted boolean;
BEGIN
  -- En el SET, half_hours es el valor de antes de actualizar.
  UPDATE class_bag
  SET half_hours = CASE WHEN half_hours >= 2 THEN 0 ELSE half_hours + 1 END,
      balance_90 = balance_90 + CASE WHEN half_hours >= 2 THEN 1 ELSE 0 END,
      updated_at = now()
  WHERE id = p_bag_id
  RETURNING half_hours = 0 INTO v_converted;

  IF v_converted THEN
    INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, booking_id, class_duration)
    VALUES (p_user_id, p_bag_id, 1, 'credit', '3 medias horas de recuperaciones en clases de 1 h', p_booking_id, '90');
  END IF;
END;
$$;
