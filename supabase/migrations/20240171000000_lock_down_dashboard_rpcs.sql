-- Mismo barrido de seguridad: get_pending_payments devuelve nombre, email
-- e importe adeudado de alumnos — comprobado en vivo que cualquiera sin
-- sesión podía llamarla y leer esos datos de cualquier club. Estas tres
-- funciones son helpers del dashboard, se llaman siempre desde el backend
-- (Next.js con service role) con el club_id ya resuelto — nunca deberían
-- ser invocables directamente por un navegador.

REVOKE EXECUTE ON FUNCTION get_pending_payments(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION count_pending_payments(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION count_classes_today(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION get_pending_payments(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION count_pending_payments(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION count_classes_today(uuid) TO service_role;
