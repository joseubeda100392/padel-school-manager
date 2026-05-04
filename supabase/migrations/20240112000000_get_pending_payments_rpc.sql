-- RPC que devuelve las mensualidades pendientes del mes actual
-- SECURITY DEFINER para bypassear RLS y evitar problemas de políticas en joins

CREATE OR REPLACE FUNCTION get_pending_payments(p_club_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  schedule_id uuid,
  student_name text,
  student_email text,
  start_time timestamptz,
  monthly_price numeric,
  paid_until date
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    ge.id,
    ge.schedule_id,
    u.name AS student_name,
    u.email AS student_email,
    s.start_time,
    ge.monthly_price,
    ge.paid_until
  FROM group_enrollments ge
  JOIN users u ON u.id = ge.student_id
  JOIN schedules s ON s.id = ge.schedule_id
  WHERE ge.status = 'active'
    AND (p_club_id IS NULL OR s.club_id = p_club_id)
    AND (
      ge.paid_until IS NULL
      OR ge.paid_until < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    )
  ORDER BY u.name;
$$;
