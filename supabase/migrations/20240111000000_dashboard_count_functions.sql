-- Funciones para el dashboard: clases hoy y cobros pendientes

CREATE OR REPLACE FUNCTION count_classes_today(p_club_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint
  FROM schedules
  WHERE is_active = true
    AND (p_club_id IS NULL OR club_id = p_club_id)
    AND (
      (recurrence = 'none' AND start_time::date = CURRENT_DATE)
      OR (recurrence IN ('weekly', 'biweekly') AND EXTRACT(DOW FROM start_time) = EXTRACT(DOW FROM CURRENT_DATE))
    )
$$;

CREATE OR REPLACE FUNCTION count_pending_payments(p_club_id uuid DEFAULT NULL)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::bigint
  FROM group_enrollments ge
  JOIN schedules s ON s.id = ge.schedule_id
  WHERE ge.status = 'active'
    AND (p_club_id IS NULL OR s.club_id = p_club_id)
    AND (
      ge.paid_until IS NULL
      OR ge.paid_until < (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date
    )
$$;
