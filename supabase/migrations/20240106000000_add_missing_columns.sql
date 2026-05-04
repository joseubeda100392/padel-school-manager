-- Columnas club_id faltantes en courts, levels y schedules
-- Usamos IF NOT EXISTS por si ya fueron añadidas directamente en Supabase

ALTER TABLE courts   ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE levels   ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS club_id   uuid REFERENCES clubs(id) ON DELETE CASCADE;
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS level_id  uuid REFERENCES levels(id) ON DELETE SET NULL;

-- levels.name era UNIQUE global — debe ser único por club
ALTER TABLE levels DROP CONSTRAINT IF EXISTS levels_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS levels_name_club_unique ON levels (name, club_id);

-- users necesita club_id si no existe
ALTER TABLE users ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;
