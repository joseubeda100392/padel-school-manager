-- security: enable RLS on clubs (previously unprotected) and group_enrollments

-- === CLUBS ===
-- This table stores Redsys merchant keys and Playtomic credentials.
-- Without RLS, any authenticated user could read other clubs' secrets.
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clubs_select_member_or_super_admin" ON clubs;
CREATE POLICY "clubs_select_member_or_super_admin"
  ON clubs FOR SELECT TO authenticated
  USING (
    id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- === GROUP ENROLLMENTS ===
-- Policies exist but ENABLE ROW LEVEL SECURITY was never applied.
ALTER TABLE group_enrollments ENABLE ROW LEVEL SECURITY;
