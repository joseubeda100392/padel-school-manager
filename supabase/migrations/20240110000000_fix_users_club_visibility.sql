-- Restringe visibilidad de usuarios por club:
-- super_admin ve todos | admin solo ve su club | cada usuario se ve a sí mismo

CREATE OR REPLACE FUNCTION get_my_club_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id FROM users WHERE id = auth.uid()
$$;

DROP POLICY IF EXISTS "users_admin_all"      ON users;
DROP POLICY IF EXISTS "users_super_admin_all" ON users;
DROP POLICY IF EXISTS "users_admin_own_club"  ON users;
DROP POLICY IF EXISTS "users_self_read"       ON users;

CREATE POLICY "users_super_admin_all" ON users FOR ALL
  USING (get_my_role() = 'super_admin')
  WITH CHECK (get_my_role() = 'super_admin');

CREATE POLICY "users_admin_own_club" ON users FOR ALL
  USING (
    get_my_role() = 'admin'
    AND club_id = get_my_club_id()
  )
  WITH CHECK (
    get_my_role() = 'admin'
    AND club_id = get_my_club_id()
  );

CREATE POLICY "users_self_read" ON users FOR SELECT
  USING (id = auth.uid());
