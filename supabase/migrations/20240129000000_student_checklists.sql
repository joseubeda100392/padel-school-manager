CREATE TABLE student_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id UUID REFERENCES users(id) ON DELETE SET NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES student_checklists(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  completed_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE student_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_checklists" ON student_checklists
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin', 'coach')
      AND (u.role = 'super_admin' OR u.club_id = student_checklists.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin', 'coach')
      AND (u.role = 'super_admin' OR u.club_id = student_checklists.club_id)
    )
  );

CREATE POLICY "staff_checklist_items" ON checklist_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM student_checklists sc
      JOIN users u ON u.id = auth.uid()
      WHERE sc.id = checklist_items.checklist_id
      AND u.role IN ('admin', 'super_admin', 'coach')
      AND (u.role = 'super_admin' OR u.club_id = sc.club_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM student_checklists sc
      JOIN users u ON u.id = auth.uid()
      WHERE sc.id = checklist_items.checklist_id
      AND u.role IN ('admin', 'super_admin', 'coach')
      AND (u.role = 'super_admin' OR u.club_id = sc.club_id)
    )
  );
