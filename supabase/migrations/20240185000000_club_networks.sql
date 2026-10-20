-- Redes de clubs (p. ej. X7: X7 PINTO y X7 MURCIA) con coordinadores que
-- pueden gestionar todas las sedes de su red, sin ser super admin.
--
-- · networks: la red.
-- · clubs.network_id: a qué red pertenece cada club. Solo el super admin
--   puede modificar clubs desde el navegador (política clubs_update_super_admin).
-- · network_coordinators: quién coordina cada red. RLS activado y SIN
--   políticas: solo el servidor (clave de servicio) lo lee y lo escribe, así
--   que nadie puede marcarse coordinador desde el navegador.
--
-- El coordinador es un admin normal. Al elegir sede, el servidor cambia su
-- users.club_id a esa sede (solo si es de su red) y toda la app funciona
-- como para un admin de ese club.
--
-- Solo añade tablas y una columna: no cambia nada de los clubs actuales.

CREATE TABLE IF NOT EXISTS networks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE networks ENABLE ROW LEVEL SECURITY;

ALTER TABLE clubs ADD COLUMN IF NOT EXISTS network_id uuid REFERENCES networks(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS clubs_network_id_idx ON clubs (network_id);

CREATE TABLE IF NOT EXISTS network_coordinators (
  user_id    uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  network_id uuid NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE network_coordinators ENABLE ROW LEVEL SECURITY;
