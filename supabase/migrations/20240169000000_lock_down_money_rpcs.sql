-- HALLAZGO CRÍTICO del repaso post-incidente: ninguna de las funciones que
-- mueven dinero/crédito de bolsa tenía sus permisos restringidos. Postgres
-- concede EXECUTE a PUBLIC por defecto al crear una función, y Supabase
-- hace que 'anon' y 'authenticated' hereden de PUBLIC — así que CUALQUIERA,
-- incluso sin haber iniciado sesión, podía llamar a estas funciones
-- directamente por la API REST de Supabase (saltándose por completo los
-- controles de permisos de Next.js) pasando el p_user_id/p_student_id que
-- quisiera. Comprobado en vivo: una llamada anónima a credit_private_bag
-- pasó todos los controles y solo falló porque el user_id de prueba no
-- existía — con un user_id real habría funcionado, dándole a cualquiera
-- clases gratis o manipulando la reserva de otro alumno.
--
-- Estas funciones solo deben poder llamarse desde el propio backend
-- (Next.js con la service role key), nunca desde el navegador de nadie.

REVOKE EXECUTE ON FUNCTION book_with_bag(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION credit_class_bag(uuid, uuid, int, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION debit_class_bag_for_booking(uuid, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION adjust_class_bag(uuid, int, int, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION book_capacity_spot(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION book_paid_class_spot(uuid, uuid, date, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION credit_private_bag(uuid, uuid, int, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION pay_private_lesson_with_bag(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_assign_spot_booking(uuid, uuid, date, uuid, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION register_for_tournament(uuid, uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION book_with_bag(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION credit_class_bag(uuid, uuid, int, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION debit_class_bag_for_booking(uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION adjust_class_bag(uuid, int, int, text) TO service_role;
GRANT EXECUTE ON FUNCTION book_capacity_spot(uuid, uuid, date) TO service_role;
GRANT EXECUTE ON FUNCTION book_paid_class_spot(uuid, uuid, date, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION credit_private_bag(uuid, uuid, int, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION pay_private_lesson_with_bag(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION admin_assign_spot_booking(uuid, uuid, date, uuid, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION register_for_tournament(uuid, uuid) TO service_role;
