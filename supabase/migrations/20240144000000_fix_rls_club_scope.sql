-- Fix group_enrollments: existing policy lacked club_id scope (any authenticated user could read all enrollments)
DROP POLICY IF EXISTS "group_enrollments_authenticated_read" ON group_enrollments;
DROP POLICY IF EXISTS "group_enrollments_club_scoped_read" ON group_enrollments;
CREATE POLICY "group_enrollments_club_scoped_read" ON group_enrollments
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Fix materials: allow coaches to insert, scope by club_id for non-super_admin
DROP POLICY IF EXISTS "materials_admin_all" ON materials;

CREATE POLICY "materials_super_admin_all"
  ON materials FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "materials_staff_select"
  ON materials FOR SELECT TO authenticated
  USING (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'coach'))
  );

CREATE POLICY "materials_staff_insert"
  ON materials FOR INSERT TO authenticated
  WITH CHECK (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'coach'))
  );

CREATE POLICY "materials_admin_update_delete"
  ON materials FOR ALL TO authenticated
  USING (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Fix schedule_exclusions: existing published-spots policy had no club_id scope
DROP POLICY IF EXISTS "schedule_exclusions_student_published" ON schedule_exclusions;
CREATE POLICY "schedule_exclusions_published_same_club" ON schedule_exclusions
  FOR SELECT TO authenticated
  USING (
    publish_spot = true
    AND EXISTS (
      SELECT 1
      FROM group_enrollments ge
      JOIN schedules s ON s.id = ge.schedule_id
      JOIN users u ON u.id = auth.uid()
      WHERE ge.id = schedule_exclusions.group_enrollment_id
        AND s.club_id = u.club_id
    )
  );
