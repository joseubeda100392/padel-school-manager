-- Fianza del alumno: pagada o no. Módulo opcional "Fianza" (clubs.features.enable_deposit).
-- Solo AÑADE una columna con valor por defecto "no pagada"; no cambia ningún dato.
-- Para deshacerlo: ALTER TABLE users DROP COLUMN IF EXISTS deposit_paid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deposit_paid boolean NOT NULL DEFAULT false;
