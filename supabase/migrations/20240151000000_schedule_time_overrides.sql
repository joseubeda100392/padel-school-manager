-- Cambio de hora puntual para todo un grupo en una fecha concreta (p.ej. la
-- pista no está libre a la hora habitual esa semana). No cambia el horario
-- fijo de la clase (schedules.start_time/end_time siguen igual para siempre),
-- solo afecta a esa fecha concreta y a todos los alumnos inscritos ese día.
CREATE TABLE IF NOT EXISTS schedule_time_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id),
  override_date date NOT NULL,
  new_start_time timestamptz NOT NULL,
  new_end_time timestamptz NOT NULL,
  reason text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id, override_date)
);

ALTER TABLE schedule_time_overrides ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado del mismo club (alumno, profe, admin)
-- necesita ver el cambio de hora. super_admin ve todo.
CREATE POLICY "schedule_time_overrides_club_read" ON schedule_time_overrides
  FOR SELECT TO authenticated
  USING (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Escritura solo vía API con service role (igual que tournament_registrations) —
-- así se valida solape de horario y club antes de insertar.
CREATE POLICY "schedule_time_overrides_no_direct_write" ON schedule_time_overrides
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
