-- Admin que también da clases (p. ej. Sergio, coordinador de X7 y monitor en
-- Pinto). Con also_coach = true aparece en las listas de monitores, se le
-- pueden asignar clases y entra en la vista de monitor sin dejar de ser admin.
-- Es el espejo de also_student (monitor que también es alumno).
--
-- Solo añade una columna con valor por defecto: no cambia nada de lo actual.
-- Ejecutar ANTES de desplegar el código que la lee.

ALTER TABLE users ADD COLUMN IF NOT EXISTS also_coach boolean NOT NULL DEFAULT false;
