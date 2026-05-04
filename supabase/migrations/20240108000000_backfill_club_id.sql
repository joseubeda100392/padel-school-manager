-- Rellena club_id en todas las tablas que lo tenían vacío tras la migración 20240106.
-- Asume un único club en el sistema (el primero por fecha de creación).

DO $$
DECLARE
  default_club uuid;
BEGIN
  SELECT id INTO default_club FROM clubs ORDER BY created_at LIMIT 1;

  IF default_club IS NULL THEN
    RAISE NOTICE 'No hay clubs — se omite el backfill';
    RETURN;
  END IF;

  UPDATE levels    SET club_id = default_club WHERE club_id IS NULL;
  UPDATE courts    SET club_id = default_club WHERE club_id IS NULL;
  UPDATE schedules SET club_id = default_club WHERE club_id IS NULL;

  -- Alumnos y monitores creados antes de que existiera la columna club_id
  UPDATE users
  SET club_id = default_club
  WHERE club_id IS NULL
    AND role IN ('student', 'coach');

  RAISE NOTICE 'Backfill completado con club %', default_club;
END $$;
