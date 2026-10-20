-- Coordinadores que no son admin de ninguna sede (solo coordinan la red).
-- Su cuenta es de admin para poder gestionar la sede en la que entren, pero
-- no aparecen en Usuarios de las sedes y, al quitarles la coordinación, su
-- cuenta se desactiva. Los que también son admin de una sede (only_coordinator
-- = false) siguen siendo admin de su sede al quitarles la coordinación.
--
-- home_club_id: su sede propia. Al cambiar de sede cambia su users.club_id;
-- al quitarle la coordinación vuelve a su sede (si no, un admin de Pinto que
-- estuviera dentro de Murcia se quedaría como admin de Murcia).
--
-- Solo añade columnas; los coordinadores actuales quedan como admin de la sede
-- en la que están ahora.

ALTER TABLE network_coordinators ADD COLUMN IF NOT EXISTS only_coordinator boolean NOT NULL DEFAULT false;
ALTER TABLE network_coordinators ADD COLUMN IF NOT EXISTS home_club_id uuid REFERENCES clubs(id) ON DELETE SET NULL;
UPDATE network_coordinators nc SET home_club_id = u.club_id FROM users u WHERE u.id = nc.user_id AND nc.home_club_id IS NULL;
