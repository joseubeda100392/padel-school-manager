-- =============================================
-- NUEVAS FUNCIONALIDADES
-- =============================================

-- 1. Fecha fin de recurrencia en clases
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS recurrence_end_date date;

-- 2. Fecha inicio/fin en alumnos (nivel usuario)
ALTER TABLE users ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE users ADD COLUMN IF NOT EXISTS end_date date;

-- 3. Fecha inicio/fin en inscripciones de grupo (por clase)
ALTER TABLE group_enrollments ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE group_enrollments ADD COLUMN IF NOT EXISTS end_date date;

-- 3b. Materiales asociados a una clase concreta (opcional, además de por nivel)
ALTER TABLE materials ADD COLUMN IF NOT EXISTS schedule_id uuid REFERENCES schedules(id) ON DELETE SET NULL;

-- 4. Cancelaciones puntuales de clase (quitar solo una sesión sin dar de baja total)
CREATE TABLE IF NOT EXISTS schedule_exclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_enrollment_id uuid REFERENCES group_enrollments(id) ON DELETE CASCADE,
  excluded_date date NOT NULL,
  reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(group_enrollment_id, excluded_date)
);

-- 5. Recuperaciones
CREATE TABLE IF NOT EXISTS makeups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES users(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id),
  original_schedule_id uuid REFERENCES schedules(id),
  makeup_schedule_id uuid REFERENCES schedules(id),
  original_date date,
  makeup_date date,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE schedule_exclusions ENABLE ROW LEVEL SECURITY;
ALTER TABLE makeups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_exclusions_admin_all" ON schedule_exclusions
  USING (get_my_role() IN ('admin', 'super_admin'));

CREATE POLICY "makeups_admin_all" ON makeups
  USING (get_my_role() IN ('admin', 'super_admin'));

CREATE POLICY "makeups_coach_read" ON makeups FOR SELECT
  USING (get_my_role() = 'coach');

CREATE POLICY "makeups_student_read" ON makeups FOR SELECT
  USING (student_id = auth.uid());
