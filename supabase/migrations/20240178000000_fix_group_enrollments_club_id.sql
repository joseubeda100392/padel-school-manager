-- Mismo bug que en bookings (migración 20240177): POST /api/group-enrollments
-- guardaba club_id: adminUser.club_id, que para un super_admin gestionando
-- un club ajeno es NULL (no está atado a ningún club). Backfill de las
-- inscripciones ya afectadas usando el club_id de su propio horario.
UPDATE group_enrollments ge
SET club_id = s.club_id
FROM schedules s
WHERE ge.schedule_id = s.id
  AND ge.club_id IS NULL
  AND s.club_id IS NOT NULL;
