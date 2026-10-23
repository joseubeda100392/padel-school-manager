-- Arreglo de 20240189: bag_transactions.booking_id es único (una reserva, un
-- movimiento), y el movimiento de "3 medias horas" llevaba la misma reserva
-- que el del gasto, así que se rechazaba y fallaba la reserva entera. El
-- movimiento de la conversión ya no va ligado a ninguna reserva.
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
    INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, class_duration)
    VALUES (p_user_id, p_bag_id, 1, 'credit', '3 medias horas de recuperaciones en clases de 1 h', '90');
  END IF;
END;
$$;
