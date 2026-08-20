-- Sustituto de monitor puntual para una fecha concreta (el titular no
-- puede dar la clase ese día) — no cambia el monitor habitual de la clase
-- (schedules.coach_id sigue igual para siempre), solo afecta a esa fecha.
-- Mismo patrón que schedule_time_overrides.
CREATE TABLE IF NOT EXISTS schedule_coach_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id),
  override_date date NOT NULL,
  new_coach_id uuid NOT NULL REFERENCES users(id),
  reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id, override_date)
);

ALTER TABLE schedule_coach_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "schedule_coach_overrides_club_read" ON schedule_coach_overrides
  FOR SELECT TO authenticated
  USING (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "schedule_coach_overrides_no_direct_write" ON schedule_coach_overrides
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
