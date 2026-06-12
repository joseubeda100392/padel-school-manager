-- Staff (admin/coach) could read users from ANY club via users_read_own_or_staff.
-- Scope staff reads to their own club; super_admin keeps global read.
DROP POLICY IF EXISTS "users_read_own_or_staff" ON users;

CREATE POLICY "users_read_own_or_staff" ON users
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.get_my_db_role() = 'super_admin'
    OR (
      public.get_my_db_role() IN ('admin', 'coach')
      AND club_id = public.get_my_club_id()
    )
  );
