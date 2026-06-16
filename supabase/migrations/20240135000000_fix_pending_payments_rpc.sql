DROP FUNCTION IF EXISTS get_pending_payments(uuid);
DROP FUNCTION IF EXISTS get_pending_payments(uuid, integer, integer);
DROP FUNCTION IF EXISTS count_pending_payments(uuid);
DROP FUNCTION IF EXISTS count_pending_payments(uuid, integer, integer);

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
      u.name::text                             AS student_name,
      u.email::text                            AS student_email,
      s.start_time::timestamptz                AS start_time,
      ge.monthly_price::integer                AS monthly_price,
      ge.paid_until::date                      AS paid_until,
      COALESCE(ge.start_date, ge.enrolled_at::date) AS enrollment_start
    FROM group_enrollments ge
    JOIN users u ON u.id = ge.student_id
    JOIN schedules s ON s.id = ge.schedule_id
    WHERE ge.status = 'active'
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
  SELECT COUNT(*)::bigint
  FROM group_enrollments ge
  JOIN schedules s ON s.id = ge.schedule_id
  WHERE ge.status = 'active'
    AND (p_club_id IS NULL OR s.club_id = p_club_id)
    AND DATE_TRUNC('month', COALESCE(ge.start_date, ge.enrolled_at::date))::date <=
        MAKE_DATE(
          COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
          COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
          1
        )
    AND (
      ge.paid_until IS NULL
      OR ge.paid_until < (
        MAKE_DATE(
          COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
          COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
          1
        ) + INTERVAL '1 month' - INTERVAL '1 day'
      )::date
    )
$$;
