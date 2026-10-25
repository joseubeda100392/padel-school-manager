-- Las inscripciones ya no se borran al salir de un grupo: se quedan con
-- status = 'ended' y su end_date (último día en el grupo), para no perder el
-- historial (quién estaba en cada clase pasada, sus faltas). Todo lo de "ahora"
-- ya filtra por status = 'active', así que una terminada no cuenta para aforo,
-- listas ni cobros futuros.
--
-- 1) Un alumno solo puede estar una vez a la vez en un grupo, pero puede volver
--    a un grupo del que salió: la regla única pasa a ignorar las terminadas.
-- 2) Cuotas pendientes: una inscripción terminada sigue debiendo hasta el mes
--    en que salió (ese mes se paga entero), nunca después. Salvo si se cambió de
--    grupo al momento: entonces lo pagado y lo debido pasaron al grupo nuevo
--    (que la sustituye con replaces_enrollment_id y empieza antes de que
--    terminara la vieja), y contarla también duplicaría la deuda.
--
-- Ejecutar DESPUÉS de desplegar el código que deja de usar upsert sobre
-- (schedule_id, student_id): el código antiguo lo necesita.

CREATE UNIQUE INDEX IF NOT EXISTS group_enrollments_current_unique
  ON group_enrollments (schedule_id, student_id)
  WHERE status <> 'ended';

ALTER TABLE group_enrollments DROP CONSTRAINT IF EXISTS group_enrollments_schedule_id_student_id_key;

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
      COALESCE(ge.start_date, ge.enrolled_at::date) AS enrollment_start,
      ge.end_date::date                        AS enrollment_end
    FROM group_enrollments ge
    JOIN users u ON u.id = ge.student_id
    JOIN schedules s ON s.id = ge.schedule_id
    WHERE (ge.status = 'active' OR (ge.status = 'ended' AND ge.end_date IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM group_enrollments n
        WHERE n.replaces_enrollment_id = ge.id AND n.student_id = ge.student_id
          AND COALESCE(n.start_date, n.enrolled_at::date) <= ge.end_date
      )))
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
  SELECT COUNT(*)::bigint
  FROM group_enrollments ge
  JOIN schedules s ON s.id = ge.schedule_id
  WHERE (ge.status = 'active' OR (ge.status = 'ended' AND ge.end_date IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM group_enrollments n
      WHERE n.replaces_enrollment_id = ge.id AND n.student_id = ge.student_id
        AND COALESCE(n.start_date, n.enrolled_at::date) <= ge.end_date
    )))
    AND (p_club_id IS NULL OR s.club_id = p_club_id)
    AND DATE_TRUNC('month', COALESCE(ge.start_date, ge.enrolled_at::date))::date <=
        MAKE_DATE(
          COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
          COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
          1
        )
    AND (ge.end_date IS NULL OR DATE_TRUNC('month', ge.end_date)::date >=
        MAKE_DATE(
          COALESCE(p_year,  EXTRACT(YEAR  FROM CURRENT_DATE)::int),
          COALESCE(p_month, EXTRACT(MONTH FROM CURRENT_DATE)::int),
          1
        ))
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

REVOKE EXECUTE ON FUNCTION get_pending_payments(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION count_pending_payments(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_pending_payments(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION count_pending_payments(uuid, integer, integer) TO service_role;
