-- URGENTE: se comprobó en vivo que la tabla `clubs` es legible por
-- CUALQUIERA sin iniciar sesión (clave pública anon), exponiendo
-- redsys_secret_key, redsys_merchant_code y credenciales de Playtomic
-- (incluida una contraseña en texto plano) de TODOS los clubes.
--
-- La migración 20240143000000_security_rls_and_constraints.sql ya
-- contenía el arreglo correcto (RLS + política por club/super_admin), pero
-- por lo visto nunca llegó a ejecutarse contra la base de datos real — el
-- mismo patrón de migración-escrita-pero-no-aplicada de otras piezas de
-- hoy. Se reaplica aquí, de forma idempotente (no rompe nada si ya estaba
-- puesta), para no depender de si aquella llegó a correr o no.

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_select_member_or_super_admin" ON clubs;
CREATE POLICY "clubs_select_member_or_super_admin"
  ON clubs FOR SELECT TO authenticated
  USING (
    id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );
