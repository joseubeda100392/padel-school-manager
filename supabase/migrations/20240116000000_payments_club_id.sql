-- Añadir club_id a payments
ALTER TABLE payments ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;

-- Rellenar club_id desde el usuario pagador
UPDATE payments p
SET club_id = u.club_id
FROM users u
WHERE p.user_id = u.id
AND p.club_id IS NULL;

-- Índice para filtrar pagos por club
CREATE INDEX IF NOT EXISTS payments_club_id_idx ON payments(club_id);
