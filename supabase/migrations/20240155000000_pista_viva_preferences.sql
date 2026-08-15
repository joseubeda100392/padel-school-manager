-- ============================================================
-- PISTA VIVA — Preferencias del alumno: días y franja horaria en
-- la que le interesa jugar. Nullable/vacío por defecto = sin
-- restricción (comportamiento igual que hasta ahora).
-- ============================================================

-- Días preferidos: 0=domingo ... 6=sábado (mismo criterio que getDayOfWeek()
-- en lib/utils.ts). Vacío o NULL = todos los días.
ALTER TABLE users ADD COLUMN IF NOT EXISTS pista_viva_preferred_days integer[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS pista_viva_preferred_start time;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pista_viva_preferred_end time;
