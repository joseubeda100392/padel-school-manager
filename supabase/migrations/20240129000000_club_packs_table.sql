-- Tabla de bonos por club (reemplaza columnas directas en clubs)
CREATE TABLE IF NOT EXISTS club_packs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id        uuid        NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name           text        NOT NULL,
  duration_type  text        NOT NULL CHECK (duration_type IN ('60', '90')),
  classes        int         NOT NULL DEFAULT 10,
  price          int         NOT NULL,          -- céntimos
  is_enabled     boolean     NOT NULL DEFAULT true,
  sort_order     int         NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS club_packs_club_id_idx ON club_packs(club_id);

ALTER TABLE club_packs ENABLE ROW LEVEL SECURITY;

-- Admins del mismo club pueden gestionar sus bonos
CREATE POLICY "admin_manage_club_packs" ON club_packs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'admin'
        AND users.club_id = club_packs.club_id
    )
  );

-- Alumnos y coaches solo pueden leer los bonos activos de su club
CREATE POLICY "members_read_club_packs" ON club_packs
  FOR SELECT
  USING (
    is_enabled = true
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.club_id = club_packs.club_id
    )
  );

-- Insertar bonos por defecto para los clubs que ya existan
INSERT INTO club_packs (club_id, name, duration_type, classes, price, sort_order)
SELECT id, 'Bono 10 clases 1h',     '60', 10, 9000,  0 FROM clubs
ON CONFLICT DO NOTHING;

INSERT INTO club_packs (club_id, name, duration_type, classes, price, sort_order)
SELECT id, 'Bono 10 clases 1h 30min', '90', 10, 12000, 1 FROM clubs
ON CONFLICT DO NOTHING;
