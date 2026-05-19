-- SECURITY DEFINER bypasses RLS when called from within a policy,
-- breaking the recursion that occurs when users policy queries users table.
CREATE OR REPLACE FUNCTION public.get_my_db_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text FROM users WHERE id = auth.uid()
$$;

-- Recreate without recursion
DROP POLICY IF EXISTS "users_read_own_or_staff" ON users;

CREATE POLICY "users_read_own_or_staff" ON users
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.get_my_db_role() IN ('admin', 'super_admin', 'coach')
  );
