-- Al reaplicar RLS en `clubs` (20240170) se cerró la fuga de secretos, pero
-- esa tabla nunca tuvo política de INSERT/UPDATE — solo la de SELECT. Con
-- RLS activo de verdad, eso bloquea a "Crear club" y "Editar club"
-- (dashboard/clubs/new y dashboard/clubs/[id]/edit), que escriben en
-- `clubs` desde el navegador con la sesión del super admin, no desde el
-- backend. Se añaden las políticas que le faltaban a esa tabla desde el
-- principio.

DROP POLICY IF EXISTS "clubs_insert_super_admin" ON clubs;
CREATE POLICY "clubs_insert_super_admin"
  ON clubs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "clubs_update_super_admin" ON clubs;
CREATE POLICY "clubs_update_super_admin"
  ON clubs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));
