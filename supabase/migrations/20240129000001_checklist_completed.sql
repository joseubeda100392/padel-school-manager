ALTER TABLE student_checklists
  ADD COLUMN completed_at TIMESTAMPTZ,
  ADD COLUMN completed_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
