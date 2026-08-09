-- Módulo de validación de clases (activable por club vía clubs.features.
-- enable_class_validation) — pensado para clubes con clases en
-- urbanizaciones donde muchas semanas no se puede dar clase.
--
-- Pieza central: class_sessions, una fila por ocurrencia real (schedule_id +
-- fecha) de una clase fija, con dos confirmaciones (profesor, luego admin).
-- Solo cuando el admin confirma se disparan los efectos: horas para nómina
-- del profesor, y descuento/cobro para los alumnos del grupo.

CREATE TABLE IF NOT EXISTS class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  club_id uuid REFERENCES clubs(id),
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'given', 'not_given')),
  cancel_reason text,
  marked_by_coach uuid REFERENCES users(id),
  marked_by_coach_at timestamptz,
  confirmed_by_admin uuid REFERENCES users(id),
  confirmed_by_admin_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(schedule_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_class_sessions_schedule ON class_sessions(schedule_id);
CREATE INDEX IF NOT EXISTS idx_class_sessions_pending_admin ON class_sessions(club_id) WHERE confirmed_by_admin IS NULL AND marked_by_coach IS NOT NULL;

-- Alumnos de grupo fijo marcados ausentes en una sesión que SÍ se dio — cada
-- fila confirmada genera automáticamente una recuperación (tabla makeups ya
-- existente, reutilizada tal cual).
CREATE TABLE IF NOT EXISTS class_session_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_session_id uuid NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES users(id),
  makeup_id uuid REFERENCES makeups(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(class_session_id, student_id)
);

-- Tarifa por hora del profesor (null = módulo no configurado para él).
ALTER TABLE users ADD COLUMN IF NOT EXISTS hourly_rate_cents integer;

-- Liquidaciones de nómina ya pagadas — "marcar como pagado" crea una fila
-- aquí y las horas de ese periodo dejan de contar como pendientes.
CREATE TABLE IF NOT EXISTS coach_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id uuid NOT NULL REFERENCES users(id),
  club_id uuid REFERENCES clubs(id),
  period_start date NOT NULL,
  period_end date NOT NULL,
  hours numeric NOT NULL,
  amount_cents integer NOT NULL,
  paid_at timestamptz DEFAULT now(),
  marked_paid_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Precio por clase suelta (para el cálculo de facturación por clases
-- realmente dadas) y contador de clases pendientes de descontar del
-- siguiente cobro por sesiones no dadas por causa del club.
ALTER TABLE group_enrollments ADD COLUMN IF NOT EXISTS price_per_class_cents integer;
ALTER TABLE group_enrollments ADD COLUMN IF NOT EXISTS discount_classes_pending integer NOT NULL DEFAULT 0;

ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_session_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_payouts ENABLE ROW LEVEL SECURITY;

-- Lectura: admin/super_admin del club, o el propio profesor de esa clase.
CREATE POLICY "class_sessions_club_read" ON class_sessions
  FOR SELECT TO authenticated
  USING (
    club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "class_sessions_no_direct_write" ON class_sessions
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "class_session_absences_club_read" ON class_session_absences
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM class_sessions cs
      WHERE cs.id = class_session_absences.class_session_id
        AND (cs.club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
             OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin'))
    )
  );

CREATE POLICY "class_session_absences_no_direct_write" ON class_session_absences
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "coach_payouts_club_read" ON coach_payouts
  FOR SELECT TO authenticated
  USING (
    coach_id = auth.uid()
    OR club_id = (SELECT club_id FROM users WHERE id = auth.uid() LIMIT 1)
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

CREATE POLICY "coach_payouts_no_direct_write" ON coach_payouts
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
