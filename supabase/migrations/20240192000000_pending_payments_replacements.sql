-- Cuotas pendientes cuando un alumno pasa de una inscripción a otra suya
-- (cambio de grupo, o clase editada "a partir de un día"): la cuota de cada
-- mes se cobra UNA vez.
--   - La vieja cuenta hasta el mes anterior al de la nueva (la nueva lleva
--     replaces_enrollment_id = vieja y es del mismo alumno).
--   - La nueva cuenta desde su mes de inicio.
--   - Lo pagado en una vale para la otra (paid_until = el mayor de las dos):
--     si se cobró la cuota del mes en el grupo viejo, no se vuelve a pedir en
--     el nuevo.
-- Antes, un cambio a mitad de mes (p. ej. desde el día 15) pedía la cuota de
-- ese mes dos veces, una por cada grupo.
--
-- count_pending_payments cuenta la misma lista, para que nunca difieran.
-- Solo reemplaza estas dos funciones; se puede ejecutar antes o después del
-- despliegue.

CREATE OR REPLACE FUNCTION get_pending_payments(
  p_club_id uuid DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  schedule_id uuid,
  student_name text,
  student_email text,
  start_time timestamptz,
  monthly_price integer,
  paid_until date,
  months_overdue integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH params AS (
    SELECT
      MAKE_DATE(
        COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
        COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
        1
      ) AS target_start,
      (MAKE_DATE(
        COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
        COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
        1
      ) + INTERVAL '1 month' - INTERVAL '1 day')::date AS target_end
  ),
  enrollments AS (
    SELECT
      ge.id,
      ge.schedule_id,
      u.name::text                                  AS student_name,
      u.email::text                                 AS student_email,
      s.start_time::timestamptz                     AS start_time,
      ge.monthly_price::integer                     AS monthly_price,
      GREATEST(ge.paid_until, prev.paid_until)::date AS paid_until,
      COALESCE(ge.start_date, ge.enrolled_at::date) AS enrollment_start,
      LEAST(ge.end_date, repl.cap)::date            AS enrollment_end
    FROM group_enrollments ge
    JOIN users u ON u.id = ge.student_id
    JOIN schedules s ON s.id = ge.schedule_id
    LEFT JOIN group_enrollments prev
      ON prev.id = ge.replaces_enrollment_id AND prev.student_id = ge.student_id
    LEFT JOIN LATERAL (
      SELECT (DATE_TRUNC('month', MIN(COALESCE(n.start_date, n.enrolled_at::date))) - INTERVAL '1 day')::date AS cap
      FROM group_enrollments n
      WHERE n.replaces_enrollment_id = ge.id AND n.student_id = ge.student_id AND n.status <> 'pending'
    ) repl ON true
    WHERE (ge.status = 'active' OR (ge.status = 'ended' AND ge.end_date IS NOT NULL))
      AND (p_club_id IS NULL OR s.club_id = p_club_id)
  )
  SELECT
    e.id::uuid,
    e.schedule_id::uuid,
    e.student_name,
    e.student_email,
    e.start_time,
    e.monthly_price,
    e.paid_until,
    GREATEST(1,
      (EXTRACT(YEAR  FROM p.target_end)::int - EXTRACT(YEAR  FROM COALESCE(e.paid_until, e.enrollment_start - INTERVAL '1 month')::date)::int) * 12 +
      (EXTRACT(MONTH FROM p.target_end)::int - EXTRACT(MONTH FROM COALESCE(e.paid_until, e.enrollment_start - INTERVAL '1 month')::date)::int)
    )::integer AS months_overdue
  FROM enrollments e
  CROSS JOIN params p
  WHERE DATE_TRUNC('month', e.enrollment_start)::date <= p.target_start
    AND (e.enrollment_end IS NULL OR DATE_TRUNC('month', e.enrollment_end)::date >= p.target_start)
    AND (e.paid_until IS NULL OR e.paid_until < p.target_end)
  ORDER BY e.student_name
$$;

CREATE OR REPLACE FUNCTION count_pending_payments(
  p_club_id uuid DEFAULT NULL,
  p_year integer DEFAULT NULL,
  p_month integer DEFAULT NULL
)
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::bigint FROM get_pending_payments(p_club_id, p_year, p_month)
$$;

REVOKE EXECUTE ON FUNCTION get_pending_payments(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION count_pending_payments(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_pending_payments(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION count_pending_payments(uuid, integer, integer) TO service_role;
