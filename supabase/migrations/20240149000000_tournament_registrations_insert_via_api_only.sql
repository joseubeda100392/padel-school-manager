-- La política treg_insert solo exigía student_id = auth.uid(), así que un
-- cliente podía insertarse directamente en tournament_registrations desde
-- el navegador saltándose el estado 'open' y el aforo (max_players), que
-- solo se validaban en /api/tournaments/register.
--
-- Esa ruta ya usa register_for_tournament() (SECURITY DEFINER, vía service
-- role), que bypassa RLS igualmente — así que no hay ninguna vía legítima
-- que dependa de un INSERT directo desde el cliente. Se cierra esa política.
DROP POLICY IF EXISTS "treg_insert" ON tournament_registrations;
CREATE POLICY "treg_insert" ON tournament_registrations
  FOR INSERT WITH CHECK (false);
