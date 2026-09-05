-- Módulo de tarifas de clase particular / alumno externo (exclusivo R3,
-- activado vía features.enable_private_lessons).
-- "is_external": alumno sin cuota fija de la escuela — paga tarifas más
-- altas y no ve los huecos libres de las clases fijas de la escuela.
-- "is_premium_private_coach": monitor cuyas clases particulares tienen
-- tarifa propia (más cara) — sustituye a un campo de precio por monitor.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium_private_coach boolean NOT NULL DEFAULT false;
