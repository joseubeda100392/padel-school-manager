-- Students should only read their own row.
-- Admins, super_admins and coaches can read all rows (needed for club management).
-- The old "users_authenticated_read" allowed ANY authenticated user to read ALL rows.

DROP POLICY IF EXISTS "users_authenticated_read" ON users;
DROP POLICY IF EXISTS "users_read_own_or_staff" ON users;

CREATE POLICY "users_read_own_or_staff" ON users
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role::text IN ('admin', 'super_admin', 'coach')
    )
  );
