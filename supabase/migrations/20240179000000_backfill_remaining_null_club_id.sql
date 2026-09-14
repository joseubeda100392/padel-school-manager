-- Limpieza de datos huérfanos: club_id NULL en 4 tablas más (bag_transactions,
-- notifications, payments, class_bag), encontradas en la misma revisión que
-- el bug de bookings/group_enrollments. No afectan al uso diario (nada
-- filtra por su club_id para mostrarlas), pero si algún día se borra un club
-- entero, estas filas no se limpiarían con él y quedarían huérfanas. Se
-- rellenan desde el club del propio usuario dueño de cada fila.
UPDATE bag_transactions t
SET club_id = u.club_id
FROM users u
WHERE t.user_id = u.id
  AND t.club_id IS NULL
  AND u.club_id IS NOT NULL;

-- bag_transactions se inserta desde ~10 funciones distintas (debit/credit/
-- adjust de bolsa normal y de particulares) y ninguna rellenaba club_id —
-- en vez de tocar las 10 una a una (riesgo alto para un campo que hoy no
-- filtra nada), un trigger lo garantiza siempre, venga de donde venga el
-- INSERT.
CREATE OR REPLACE FUNCTION set_bag_transaction_club_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.club_id IS NULL THEN
    SELECT club_id INTO NEW.club_id FROM users WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bag_transactions_club_id ON bag_transactions;
CREATE TRIGGER trg_bag_transactions_club_id
  BEFORE INSERT ON bag_transactions
  FOR EACH ROW EXECUTE FUNCTION set_bag_transaction_club_id();

UPDATE notifications n
SET club_id = u.club_id
FROM users u
WHERE n.user_id = u.id
  AND n.club_id IS NULL
  AND u.club_id IS NOT NULL;

UPDATE payments p
SET club_id = u.club_id
FROM users u
WHERE p.user_id = u.id
  AND p.club_id IS NULL
  AND u.club_id IS NOT NULL;

UPDATE class_bag cb
SET club_id = u.club_id
FROM users u
WHERE cb.user_id = u.id
  AND cb.club_id IS NULL
  AND u.club_id IS NOT NULL;
