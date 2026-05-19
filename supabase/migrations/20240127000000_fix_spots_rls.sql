-- Students must be able to read published spots and the group_enrollment join that links to the schedule

-- 1. Allow students to read schedule_exclusions where publish_spot = true
CREATE POLICY "schedule_exclusions_student_published" ON schedule_exclusions
  FOR SELECT USING (publish_spot = true);

-- 2. Allow all authenticated users to read group_enrollments
--    (needed to resolve schedule_id from the spot → students see class info, not sensitive)
CREATE POLICY "group_enrollments_authenticated_read" ON group_enrollments
  FOR SELECT USING (auth.uid() IS NOT NULL);
