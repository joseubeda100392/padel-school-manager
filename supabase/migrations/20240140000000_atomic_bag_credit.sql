-- Función atómica para acreditar clases a la bolsa.
-- Reemplaza el patrón read-modify-write del webhook de Redsys.
-- Un UPDATE atómico elimina la race condition cuando dos webhooks
-- para el mismo usuario llegan en paralelo (retransmisiones de Redsys).

CREATE OR REPLACE FUNCTION credit_class_bag(
  p_user_id   uuid,
  p_club_id   uuid,
  p_delta     int,
  p_pack_type text,   -- '60' | '90'
  p_reason    text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bag_id       uuid;
  v_new_balance  int;
BEGIN
  -- Garantizar que existe la fila antes del UPDATE
  INSERT INTO class_bag (user_id, club_id, balance_60, balance_90)
  VALUES (p_user_id, p_club_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- UPDATE atómico: la BD suma directamente, sin read-modify-write
  IF p_pack_type = '90' THEN
    UPDATE class_bag
    SET balance_90 = balance_90 + p_delta,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING id, balance_90 INTO v_bag_id, v_new_balance;
  ELSE
    UPDATE class_bag
    SET balance_60 = balance_60 + p_delta,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING id, balance_60 INTO v_bag_id, v_new_balance;
  END IF;

  INSERT INTO bag_transactions (user_id, class_bag_id, delta, type, reason, class_duration)
  VALUES (p_user_id, v_bag_id, p_delta, 'credit', p_reason, p_pack_type);

  RETURN jsonb_build_object('ok', true, 'bag_id', v_bag_id, 'new_balance', v_new_balance);
END;
$$;
