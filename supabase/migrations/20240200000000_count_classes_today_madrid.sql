-- count_classes_today comparaba con CURRENT_DATE y el día de la semana en UTC (zona de la base de datos):
-- entre las 00:00 y las 01:00/02:00 de España contaba las clases del día anterior, y una clase de las
-- 00:30 de España caía en el día de antes. Ahora todo en Europe/Madrid. Solo lectura, misma firma y permisos.
CREATE OR REPLACE FUNCTION count_classes_today(p_club_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (SELECT (now() AT TIME ZONE 'Europe/Madrid')::date AS today)
  SELECT count(*)::bigint
  FROM schedules, t
  WHERE is_active = true
    AND (p_club_id IS NULL OR club_id = p_club_id)
    AND (
      (recurrence = 'none' AND (start_time AT TIME ZONE 'Europe/Madrid')::date = t.today)
      OR (
        recurrence IN ('weekly', 'biweekly')
        AND EXTRACT(DOW FROM (start_time AT TIME ZONE 'Europe/Madrid')) = EXTRACT(DOW FROM t.today)
        AND (start_time AT TIME ZONE 'Europe/Madrid')::date <= t.today
        AND (recurrence_end_date IS NULL OR recurrence_end_date >= t.today)
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION count_classes_today(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION count_classes_today(uuid) TO service_role;
